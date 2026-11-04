import logging

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.dataset import Dataset
from app.models.dataset_version import DatasetVersion
from app.models.user import User
from app.schemas.dataset import DatasetDashboard, DatasetSummary
from app.services.dataset_service import (
    dataset_dashboard,
    dataset_summary,
    get_owned_dataset,
)
from app.services.storage_service import delete_dataset_file, save_dataset_file
from app.services.validation_service import parse_delimited_file

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_UPLOAD_SIZE = 10 * 1024 * 1024


@router.post(
    "/upload",
    response_model=DatasetDashboard,
    status_code=status.HTTP_201_CREATED,
)
async def upload_dataset(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DatasetDashboard:
    original_filename = (file.filename or "").replace("\\", "/").rsplit("/", 1)[-1]
    if not original_filename or len(original_filename) > 255:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Choose a file with a name no longer than 255 characters.",
        )

    file_type = original_filename.rsplit(".", 1)[-1].lower()
    if file_type not in {"csv", "tsv"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Choose a .csv or .tsv file.",
        )

    content = await file.read(MAX_UPLOAD_SIZE + 1)
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Files must be 10 MB or smaller.",
        )
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The selected file is empty.",
        )

    try:
        preview = parse_delimited_file(content, file_type)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error

    try:
        stored_path = save_dataset_file(content, file_type)
    except OSError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The uploaded file could not be stored.",
        ) from error

    dataset = Dataset(
        name=original_filename,
        original_filename=original_filename,
        file_path=str(stored_path),
        file_type=file_type,
        file_size=len(content),
        owner_id=current_user.id,
        status="uploaded",
    )
    version = DatasetVersion(
        version_number=1,
        file_path=str(stored_path),
        row_count=preview.row_count,
        column_count=preview.column_count,
        missing_cells=preview.missing_cells,
        status="uploaded",
    )
    dataset.versions.append(version)
    db.add(dataset)
    try:
        db.flush()
        db.refresh(dataset)
        response = DatasetDashboard(
            id=dataset.id,
            name=dataset.name,
            original_filename=dataset.original_filename,
            file_type=dataset.file_type,
            file_size=dataset.file_size,
            status=dataset.status,
            created_at=dataset.created_at,
            row_count=preview.row_count,
            column_count=preview.column_count,
            missing_cells=preview.missing_cells,
            version_number=version.version_number,
            headers=preview.headers,
            preview_rows=preview.preview_rows,
        )
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        try:
            stored_path.unlink(missing_ok=True)
        except OSError:
            logger.exception("Could not remove uploaded file after database failure.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The dataset could not be saved to the database.",
        ) from error

    return response


@router.get("", response_model=list[DatasetSummary])
def list_datasets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DatasetSummary]:
    datasets = db.scalars(
        select(Dataset)
        .options(selectinload(Dataset.versions))
        .where(Dataset.owner_id == current_user.id)
        .order_by(Dataset.created_at.desc(), Dataset.id.desc())
    ).all()
    return [dataset_summary(dataset) for dataset in datasets]


@router.get("/{dataset_id}", response_model=DatasetDashboard)
def get_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DatasetDashboard:
    dataset = get_owned_dataset(db, dataset_id, current_user.id)
    return dataset_dashboard(dataset)


@router.delete("/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    dataset = get_owned_dataset(db, dataset_id, current_user.id)
    file_paths = {version.file_path for version in dataset.versions}
    db.delete(dataset)
    try:
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The dataset could not be deleted from the database.",
        ) from error

    try:
        for file_path in file_paths:
            delete_dataset_file(file_path)
    except (OSError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The dataset record was deleted, but its stored file could not be removed.",
        ) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)
