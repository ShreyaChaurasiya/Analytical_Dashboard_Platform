import logging

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.dataset import Dataset
from app.models.dashboard_export import DashboardExport
from app.models.dataset_version import DatasetVersion
from app.models.report import Report
from app.models.user import User
from app.schemas.dataset import DatasetDashboard, DatasetFilePreview, DatasetSummary
from app.services.dataset_service import (
    dataset_dashboard,
    dataset_summary,
    get_owned_dataset,
)
from app.services.storage_service import (
    delete_dashboard_export_file,
    delete_dataset_file,
    delete_report_file,
    save_dataset_file,
)
from app.services.validation_service import (
    SUPPORTED_FILE_TYPES,
    DatasetPreview,
    parse_delimited_file,
)

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_UPLOAD_SIZE = 10 * 1024 * 1024


async def _read_and_preview(
    file: UploadFile,
) -> tuple[str, str, bytes, DatasetPreview]:
    original_filename = (file.filename or "").replace("\\", "/").rsplit("/", 1)[-1]
    if not original_filename or len(original_filename) > 255 or "." not in original_filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Choose a file with a valid name and extension no longer than 255 characters.",
        )

    extension = original_filename.rsplit(".", 1)[-1].lower()
    file_type = "sqlite" if extension in {"db", "sqlite3"} else extension
    if file_type not in SUPPORTED_FILE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This file format is not supported.",
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
    return original_filename, file_type, content, preview


@router.post("/preview", response_model=DatasetFilePreview)
async def preview_dataset(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> DatasetFilePreview:
    _, _, _, preview = await _read_and_preview(file)
    return DatasetFilePreview(
        headers=preview.headers,
        preview_rows=preview.preview_rows,
        row_count=preview.row_count,
        column_count=preview.column_count,
        missing_cells=preview.missing_cells,
    )


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
    original_filename, file_type, content, preview = await _read_and_preview(file)

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
    report_file_paths = db.scalars(
        select(Report.file_path).where(Report.dataset_id == dataset.id)
    ).all()
    dashboard_exports = db.scalars(
        select(DashboardExport).where(DashboardExport.user_id == current_user.id)
    ).all()
    dashboard_export_paths = [export.file_path for export in dashboard_exports]
    preferences = current_user.preferences or {}
    if preferences.get("dashboard_default_dataset_id") == dataset.id:
        current_user.preferences = {
            **preferences,
            "dashboard_default_dataset_id": None,
        }
    db.delete(dataset)
    for export in dashboard_exports:
        db.delete(export)
    try:
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The dataset could not be deleted from the database.",
        ) from error

    cleanup_errors = []
    for file_paths_to_delete, delete_file in (
        (report_file_paths, delete_report_file),
        (file_paths, delete_dataset_file),
        (dashboard_export_paths, delete_dashboard_export_file),
    ):
        for file_path in file_paths_to_delete:
            try:
                delete_file(file_path)
            except (OSError, ValueError) as error:
                cleanup_errors.append(error)
                logger.exception("Could not remove a stored file while deleting dataset %s.", dataset_id)
    if cleanup_errors:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "The dataset record was deleted, but one or more stored dataset, "
                "report, or dashboard download files could not be removed."
            ),
        ) from cleanup_errors[0]
    return Response(status_code=status.HTTP_204_NO_CONTENT)
