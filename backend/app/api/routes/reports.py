import logging

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.analysis import Analysis
from app.models.dataset import Dataset
from app.models.quality_issue import QualityIssue
from app.models.report import Report
from app.models.user import User
from app.schemas.report import ReportCreate, ReportPreview, ReportSummary
from app.services.dataset_service import get_owned_dataset
from app.services.report_service import generate_report
from app.services.storage_service import (
    delete_report_file,
    get_report_file_path,
    save_report_file,
)

router = APIRouter(tags=["reports"])
logger = logging.getLogger(__name__)


def _report_response(report: Report, dataset_name: str) -> ReportSummary:
    return ReportSummary(
        id=report.id,
        dataset_id=report.dataset_id,
        analysis_id=report.analysis_id,
        format=report.format,
        created_at=report.created_at,
        dataset_name=dataset_name,
    )


@router.post(
    "/datasets/{dataset_id}/reports",
    response_model=ReportSummary,
    status_code=status.HTTP_201_CREATED,
)
def create_report(
    dataset_id: int,
    request: ReportCreate = ReportCreate(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReportSummary:
    dataset = get_owned_dataset(db, dataset_id, current_user.id)
    analysis = db.scalar(
        select(Analysis)
        .where(Analysis.dataset_id == dataset.id)
        .order_by(Analysis.created_at.desc(), Analysis.id.desc())
        .limit(1)
    )
    if analysis is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Run an analysis before generating a report.",
        )

    issues = db.scalars(
        select(QualityIssue).where(QualityIssue.analysis_id == analysis.id)
    ).all()
    report_bytes = generate_report(
        request.format,
        dataset.name,
        analysis.results,
        [
            {
                "issue_type": issue.issue_type,
                "column_name": issue.column_name,
                "severity": issue.severity,
                "affected_rows": issue.affected_rows,
                "description": issue.description,
                "details": issue.details,
            }
            for issue in issues
        ],
    )
    try:
        stored_path = save_report_file(report_bytes, request.format)
    except OSError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The report file could not be stored.",
        ) from error

    report = Report(
        dataset_id=dataset.id,
        analysis_id=analysis.id,
        format=request.format,
        file_path=str(stored_path),
    )
    db.add(report)
    try:
        db.flush()
        db.refresh(report)
        response = _report_response(report, dataset.name)
        db.commit()
        return response
    except SQLAlchemyError as error:
        db.rollback()
        try:
            stored_path.unlink(missing_ok=True)
        except OSError:
            logger.exception("Could not remove report file after database failure.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The report could not be saved to the database.",
        ) from error


@router.get("", response_model=list[ReportSummary])
def list_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ReportSummary]:
    records = db.execute(
        select(Report, Dataset.name)
        .join(Dataset, Dataset.id == Report.dataset_id)
        .where(Dataset.owner_id == current_user.id)
        .order_by(Report.created_at.desc(), Report.id.desc())
    ).all()
    return [_report_response(report, name) for report, name in records]


def _get_owned_report(db: Session, report_id: int, owner_id: int) -> tuple[Report, str]:
    record = db.execute(
        select(Report, Dataset.name)
        .join(Dataset, Dataset.id == Report.dataset_id)
        .where(Report.id == report_id, Dataset.owner_id == owner_id)
    ).first()
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found.",
        )
    return record


@router.get("/reports/{report_id}", response_model=ReportSummary)
def get_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReportSummary:
    report, dataset_name = _get_owned_report(db, report_id, current_user.id)
    return _report_response(report, dataset_name)


@router.get("/reports/{report_id}/preview", response_model=ReportPreview)
def preview_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReportPreview:
    report, dataset_name = _get_owned_report(db, report_id, current_user.id)
    analysis = db.get(Analysis, report.analysis_id)
    if analysis is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The analysis for this report is no longer available.",
        )

    issues = db.scalars(
        select(QualityIssue)
        .where(QualityIssue.analysis_id == analysis.id)
        .order_by(QualityIssue.severity, QualityIssue.id)
    ).all()
    return ReportPreview(
        **_report_response(report, dataset_name).model_dump(),
        row_count=analysis.results["row_count"],
        column_count=analysis.results["column_count"],
        missing_cells=analysis.results["missing_cells"],
        duplicate_rows=analysis.results["duplicate_rows"],
        columns=analysis.results["columns"],
        quality_issues=[
            {
                "issue_type": issue.issue_type,
                "column_name": issue.column_name,
                "severity": issue.severity,
                "affected_rows": issue.affected_rows,
                "description": issue.description,
            }
            for issue in issues
        ],
    )


@router.get("/reports/{report_id}/download")
def download_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report, _ = _get_owned_report(db, report_id, current_user.id)
    try:
        file_path = get_report_file_path(report.file_path)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The stored report path is invalid.",
        ) from error
    if not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The report file is no longer available.",
        )
    media_type = (
        "application/pdf"
        if report.format == "pdf"
        else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    return FileResponse(
        file_path,
        media_type=media_type,
        filename=f"adp-dataset-{report.dataset_id}-report-{report.id}.{report.format}",
    )


@router.delete("/reports/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    report, _ = _get_owned_report(db, report_id, current_user.id)
    file_path = report.file_path
    try:
        db.delete(report)
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("Could not delete report %s from the database.", report_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The report could not be deleted from the database.",
        ) from error

    try:
        delete_report_file(file_path)
    except (OSError, ValueError) as error:
        logger.exception("Report %s was deleted from the database, but its file could not be removed.", report_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The report record was deleted, but its stored file could not be removed.",
        ) from error

    return Response(status_code=status.HTTP_204_NO_CONTENT)
