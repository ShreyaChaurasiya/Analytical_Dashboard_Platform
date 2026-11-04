import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.analysis import Analysis
from app.models.dataset import Dataset
from app.models.quality_issue import QualityIssue
from app.models.user import User
from app.schemas.analysis import AnalysisResponse
from app.services.analysis_service import analyze_dataframe
from app.services.dataset_service import get_owned_dataset, latest_version
from app.services.quality_service import find_quality_issues
from app.services.storage_service import get_dataset_file_path
from app.services.validation_service import load_dataset_dataframe

router = APIRouter(tags=["analysis"])
logger = logging.getLogger(__name__)


def _load_dataframe(dataset: Dataset, file_path: str):
    try:
        path = get_dataset_file_path(file_path)
        return load_dataset_dataframe(path.read_bytes(), dataset.file_type or "")
    except (OSError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The stored dataset file is unavailable or invalid.",
        ) from error


def _analysis_response(db: Session, analysis: Analysis) -> AnalysisResponse:
    issue_count = db.scalar(
        select(func.count(QualityIssue.id)).where(
            QualityIssue.analysis_id == analysis.id
        )
    ) or 0
    return AnalysisResponse(
        id=analysis.id,
        dataset_id=analysis.dataset_id,
        dataset_version_id=analysis.dataset_version_id,
        created_at=analysis.created_at,
        quality_issue_count=issue_count,
        results=analysis.results,
    )


@router.post(
    "/datasets/{dataset_id}/analysis",
    response_model=AnalysisResponse,
    status_code=status.HTTP_201_CREATED,
)
def start_analysis(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnalysisResponse:
    dataset = get_owned_dataset(db, dataset_id, current_user.id)
    version = latest_version(dataset)
    if version is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Upload a dataset version before running analysis.",
        )

    dataframe = _load_dataframe(dataset, version.file_path)
    results = analyze_dataframe(dataframe)
    issues = find_quality_issues(dataframe)
    analysis = Analysis(
        dataset_id=dataset.id,
        dataset_version_id=version.id,
        results=results,
    )
    db.add(analysis)
    try:
        db.flush()
        db.add_all(
            [
                QualityIssue(
                    dataset_id=dataset.id,
                    analysis_id=analysis.id,
                    **issue,
                )
                for issue in issues
            ]
        )
        db.flush()
        response = _analysis_response(db, analysis)
        db.commit()
        return response
    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("Could not save analysis results for dataset %s.", dataset.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The analysis results could not be saved.",
        ) from error


@router.get(
    "/datasets/{dataset_id}/analysis",
    response_model=AnalysisResponse | None,
)
def get_latest_analysis(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnalysisResponse | None:
    get_owned_dataset(db, dataset_id, current_user.id)
    analysis = db.scalar(
        select(Analysis)
        .where(Analysis.dataset_id == dataset_id)
        .order_by(Analysis.created_at.desc(), Analysis.id.desc())
        .limit(1)
    )
    if analysis is None:
        return None
    return _analysis_response(db, analysis)
