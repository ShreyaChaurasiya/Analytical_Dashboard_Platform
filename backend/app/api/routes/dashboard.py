import csv
import io
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.analysis import Analysis
from app.models.dashboard_export import DashboardExport
from app.models.dataset import Dataset
from app.models.quality_issue import QualityIssue
from app.models.report import Report
from app.models.user import User
from app.schemas.dashboard import (
    DashboardExportCreate,
    DashboardExportSummary,
    DashboardLayout,
    DashboardLayoutUpdate,
)
from app.schemas.dataset import DatasetDashboard
from app.services.dataset_service import dataset_dashboard, dataset_summary, get_owned_dataset
from app.services.storage_service import (
    delete_dashboard_export_file,
    get_dashboard_export_file_path,
    save_dashboard_export,
)

router = APIRouter(tags=["dashboard"])
logger = logging.getLogger(__name__)


@router.get(
    "/datasets/{dataset_id}/dashboard",
    response_model=DatasetDashboard,
)
def get_dashboard(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DatasetDashboard:
    dataset = get_owned_dataset(db, dataset_id, current_user.id)
    return dataset_dashboard(dataset)


def _default_dashboard_layout(dataset: Dataset) -> dict:
    return {
        "title": dataset.name[:120],
        "visible_widgets": [
            "value-distribution",
            "numeric-profile",
            "missing-values",
            "column-overview",
            "insights",
            "correlations",
        ],
        "category_column": None,
        "numeric_column": None,
        "distribution_chart": "bar",
    }


@router.get(
    "/datasets/{dataset_id}/layout",
    response_model=DashboardLayout,
)
def get_dashboard_layout(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardLayout:
    dataset = get_owned_dataset(db, dataset_id, current_user.id)
    preferences = current_user.preferences or {}
    layouts = preferences.get("dashboard_layouts", {})
    saved_layout = layouts.get(str(dataset.id), {}) if isinstance(layouts, dict) else {}
    return DashboardLayout.model_validate(
        {**_default_dashboard_layout(dataset), **saved_layout}
    )


@router.put(
    "/datasets/{dataset_id}/layout",
    response_model=DashboardLayout,
)
def update_dashboard_layout(
    dataset_id: int,
    update: DashboardLayoutUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardLayout:
    dataset = get_owned_dataset(db, dataset_id, current_user.id)
    analysis = db.scalar(
        select(Analysis)
        .where(Analysis.dataset_id == dataset.id)
        .order_by(Analysis.created_at.desc(), Analysis.id.desc())
        .limit(1)
    )
    columns = analysis.results.get("columns", []) if analysis else []
    column_types = {
        column.get("name"): column.get("inferred_type")
        for column in columns
        if isinstance(column, dict)
    }
    if update.category_column and column_types.get(update.category_column) not in {"categorical", "boolean"}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Choose a categorical or boolean column for the value distribution.",
        )
    if update.numeric_column and column_types.get(update.numeric_column) != "numeric":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Choose a numeric column for the numeric profile.",
        )

    preferences = dict(current_user.preferences or {})
    saved_layouts = preferences.get("dashboard_layouts", {})
    layouts = dict(saved_layouts) if isinstance(saved_layouts, dict) else {}
    layout = update.model_dump()
    layouts[str(dataset.id)] = layout
    preferences["dashboard_layouts"] = layouts
    current_user.preferences = preferences
    try:
        db.commit()
        db.refresh(current_user)
    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("Could not save dashboard layout for dataset %s.", dataset.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The dashboard layout could not be saved.",
        ) from error
    return DashboardLayout.model_validate(layout)


def _csv_value(value: str) -> str:
    if value.startswith(("=", "+", "-", "@", "\t", "\r")):
        return f"'{value}"
    return value


@router.post("/exports/summary", response_model=DashboardExportSummary, status_code=status.HTTP_201_CREATED)
def create_dashboard_summary_export(
    request: DashboardExportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardExportSummary:
    if request.dataset_id is not None:
        datasets = [get_owned_dataset(db, request.dataset_id, current_user.id)]
    else:
        query = (
            select(Dataset)
            .options(selectinload(Dataset.versions))
            .where(Dataset.owner_id == current_user.id)
            .order_by(Dataset.created_at.desc(), Dataset.id.desc())
        )
        if request.time_range != "all":
            cutoff = datetime.now(timezone.utc) - timedelta(days=int(request.time_range))
            query = query.where(Dataset.created_at >= cutoff)
        datasets = db.scalars(query).all()

    scores = []
    for dataset in datasets:
        summary = dataset_summary(dataset)
        cells = (summary.row_count or 0) * (summary.column_count or 0)
        if cells and summary.missing_cells is not None:
            scores.append(round(max(0, cells - summary.missing_cells) / cells * 100))
    quality_score = (
        str(round(sum(scores) / len(scores)))
        if scores
        else "Not available"
    )

    report_count = db.scalar(
        select(func.count(Report.id))
        .join(Dataset, Dataset.id == Report.dataset_id)
        .where(Dataset.owner_id == current_user.id)
    ) or 0

    dataset_name = "All uploaded datasets"
    headers = ""
    pending_reviews = ""
    if request.dataset_id is not None:
        selected_dataset = datasets[0]
        dataset_name = selected_dataset.name
        selected_dashboard = dataset_dashboard(selected_dataset)
        headers = " | ".join(selected_dashboard.headers)
        latest_analysis = db.scalar(
            select(Analysis)
            .where(Analysis.dataset_id == selected_dataset.id)
            .order_by(Analysis.created_at.desc(), Analysis.id.desc())
            .limit(1)
        )
        pending_reviews = str(
            db.scalar(
                select(func.count(QualityIssue.id)).where(
                    QualityIssue.analysis_id == latest_analysis.id
                )
            ) or 0
        ) if latest_analysis else "0"

    output = io.StringIO(newline="")
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(["item", "value"])
    writer.writerow(["Dataset", _csv_value(dataset_name)])
    writer.writerow(["Data quality score", quality_score if quality_score == "Not available" else f"{quality_score}%"])
    writer.writerow(["Reports generated", str(report_count)])
    writer.writerow(["Pending reviews", pending_reviews])
    writer.writerow(["Column names", _csv_value(headers)])
    content = output.getvalue().encode("utf-8")
    file_name = f"adp-dashboard-summary-{datetime.now(timezone.utc):%Y%m%d-%H%M%S}.csv"
    try:
        stored_path = save_dashboard_export(content)
    except OSError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The dashboard summary could not be stored.",
        ) from error

    record = DashboardExport(
        user_id=current_user.id,
        file_name=file_name,
        file_path=str(stored_path),
    )
    db.add(record)
    try:
        db.flush()
        db.refresh(record)
        response = DashboardExportSummary.model_validate(record)
        db.commit()
        return response
    except SQLAlchemyError as error:
        db.rollback()
        try:
            stored_path.unlink(missing_ok=True)
        except OSError:
            logger.exception("Could not remove dashboard export after database failure.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The dashboard summary could not be recorded.",
        ) from error


@router.get("/exports", response_model=list[DashboardExportSummary])
def list_dashboard_exports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DashboardExportSummary]:
    records = db.scalars(
        select(DashboardExport)
        .where(DashboardExport.user_id == current_user.id)
        .order_by(DashboardExport.created_at.desc(), DashboardExport.id.desc())
    ).all()
    return [DashboardExportSummary.model_validate(record) for record in records]


@router.get("/exports/{export_id}/download")
def download_dashboard_export(
    export_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    export = db.scalar(
        select(DashboardExport).where(
            DashboardExport.id == export_id,
            DashboardExport.user_id == current_user.id,
        )
    )
    if export is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard download not found.")
    try:
        file_path = get_dashboard_export_file_path(export.file_path)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The stored dashboard download path is invalid.",
        ) from error
    if not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The stored dashboard download is no longer available.",
        )
    return FileResponse(file_path, media_type="text/csv", filename=export.file_name)


@router.delete("/exports/{export_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dashboard_export(
    export_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    export = db.scalar(
        select(DashboardExport).where(
            DashboardExport.id == export_id,
            DashboardExport.user_id == current_user.id,
        )
    )
    if export is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard download not found.")
    file_path = export.file_path
    try:
        db.delete(export)
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("Could not delete dashboard export %s from the database.", export_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The dashboard download could not be deleted.",
        ) from error
    try:
        delete_dashboard_export_file(file_path)
    except (OSError, ValueError) as error:
        logger.exception("Dashboard export %s was deleted from the database, but its file could not be removed.", export_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The dashboard download record was deleted, but its stored file could not be removed.",
        ) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)
