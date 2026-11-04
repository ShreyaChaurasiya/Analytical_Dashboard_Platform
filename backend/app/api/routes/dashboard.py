from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.dataset import DatasetDashboard
from app.services.dataset_service import dataset_dashboard, get_owned_dataset

router = APIRouter(tags=["dashboard"])


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
