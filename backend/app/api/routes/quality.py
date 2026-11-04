from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.analysis import Analysis
from app.models.quality_issue import QualityIssue
from app.models.user import User
from app.schemas.quality import QualityIssueResponse
from app.services.dataset_service import get_owned_dataset

router = APIRouter(tags=["quality"])


@router.get(
    "/datasets/{dataset_id}/issues",
    response_model=list[QualityIssueResponse],
)
def list_issues(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[QualityIssueResponse]:
    get_owned_dataset(db, dataset_id, current_user.id)
    latest_analysis_id = db.scalar(
        select(Analysis.id)
        .where(Analysis.dataset_id == dataset_id)
        .order_by(Analysis.created_at.desc(), Analysis.id.desc())
        .limit(1)
    )
    if latest_analysis_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Run an analysis before requesting data-quality findings.",
        )

    return list(
        db.scalars(
            select(QualityIssue)
            .where(QualityIssue.analysis_id == latest_analysis_id)
            .order_by(QualityIssue.severity.desc(), QualityIssue.id)
        ).all()
    )
