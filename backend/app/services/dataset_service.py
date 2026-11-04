"""Dataset lookup and API response assembly."""

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.dataset import Dataset
from app.models.dataset_version import DatasetVersion
from app.schemas.dataset import DatasetDashboard, DatasetSummary
from app.services.storage_service import get_dataset_file_path
from app.services.validation_service import parse_delimited_file


def get_owned_dataset(db: Session, dataset_id: int, owner_id: int) -> Dataset:
    dataset = db.scalar(
        select(Dataset)
        .options(selectinload(Dataset.versions))
        .where(Dataset.id == dataset_id, Dataset.owner_id == owner_id)
    )
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found.",
        )
    return dataset


def latest_version(dataset: Dataset) -> DatasetVersion | None:
    return max(dataset.versions, key=lambda version: version.version_number, default=None)


def dataset_summary(dataset: Dataset) -> DatasetSummary:
    version = latest_version(dataset)
    return DatasetSummary(
        id=dataset.id,
        name=dataset.name,
        original_filename=dataset.original_filename,
        file_type=dataset.file_type,
        file_size=dataset.file_size,
        status=dataset.status,
        created_at=dataset.created_at,
        row_count=version.row_count if version else None,
        column_count=version.column_count if version else None,
        missing_cells=version.missing_cells if version else None,
        version_number=version.version_number if version else None,
    )


def dataset_dashboard(dataset: Dataset) -> DatasetDashboard:
    version = latest_version(dataset)
    if version is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This dataset has no uploaded file version.",
        )
    try:
        file_path = get_dataset_file_path(version.file_path)
        preview = parse_delimited_file(file_path.read_bytes(), dataset.file_type or "")
    except (OSError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The stored dataset file is unavailable or invalid.",
        ) from error

    response = dataset_summary(dataset).model_dump()
    response.update(
        headers=preview.headers,
        preview_rows=preview.preview_rows,
        row_count=preview.row_count,
        column_count=preview.column_count,
        missing_cells=version.missing_cells
        if version.missing_cells is not None
        else preview.missing_cells,
    )
    return DatasetDashboard(**response)
