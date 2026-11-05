"""Local storage for original uploaded dataset files."""

from pathlib import Path
from typing import BinaryIO
from uuid import uuid4


_DATASET_STORAGE_DIR = Path(__file__).resolve().parents[2] / ".data" / "datasets"
_REPORT_STORAGE_DIR = Path(__file__).resolve().parents[2] / ".data" / "reports"
_DASHBOARD_EXPORT_STORAGE_DIR = Path(__file__).resolve().parents[2] / ".data" / "dashboard-exports"


class DatasetUploadTooLargeError(ValueError):
    """Raised when a streamed dataset exceeds the configured upload limit."""


def save_dataset_file_stream(
    source: BinaryIO,
    file_type: str,
    max_size: int,
    chunk_size: int = 1024 * 1024,
) -> tuple[Path, int]:
    _DATASET_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    path = _DATASET_STORAGE_DIR / f"{uuid4().hex}.{file_type}"
    total_size = 0
    try:
        with path.open("wb") as destination:
            while chunk := source.read(chunk_size):
                total_size += len(chunk)
                if total_size > max_size:
                    raise DatasetUploadTooLargeError
                destination.write(chunk)
        if total_size == 0:
            raise ValueError("The selected file is empty.")
        return path, total_size
    except Exception:
        path.unlink(missing_ok=True)
        raise


def save_dataset_file(content: bytes, file_type: str) -> Path:
    _DATASET_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    path = _DATASET_STORAGE_DIR / f"{uuid4().hex}.{file_type}"
    path.write_bytes(content)
    return path


def get_dataset_file_path(file_path: str) -> Path:
    storage_dir = _DATASET_STORAGE_DIR.resolve()
    path = Path(file_path).resolve()
    if path.parent != storage_dir:
        raise ValueError("The stored file path is outside the dataset storage directory.")
    return path


def delete_dataset_file(file_path: str) -> None:
    get_dataset_file_path(file_path).unlink(missing_ok=True)


def save_report_file(content: bytes, file_type: str) -> Path:
    _REPORT_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    path = _REPORT_STORAGE_DIR / f"{uuid4().hex}.{file_type}"
    path.write_bytes(content)
    return path


def get_report_file_path(file_path: str) -> Path:
    storage_dir = _REPORT_STORAGE_DIR.resolve()
    path = Path(file_path).resolve()
    if path.parent != storage_dir:
        raise ValueError("The stored file path is outside the report storage directory.")
    return path


def delete_report_file(file_path: str) -> None:
    get_report_file_path(file_path).unlink(missing_ok=True)


def save_dashboard_export(content: bytes) -> Path:
    _DASHBOARD_EXPORT_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    path = _DASHBOARD_EXPORT_STORAGE_DIR / f"{uuid4().hex}.csv"
    path.write_bytes(content)
    return path


def get_dashboard_export_file_path(file_path: str) -> Path:
    storage_dir = _DASHBOARD_EXPORT_STORAGE_DIR.resolve()
    path = Path(file_path).resolve()
    if path.parent != storage_dir:
        raise ValueError("The stored file path is outside the dashboard export directory.")
    return path


def delete_dashboard_export_file(file_path: str) -> None:
    get_dashboard_export_file_path(file_path).unlink(missing_ok=True)
