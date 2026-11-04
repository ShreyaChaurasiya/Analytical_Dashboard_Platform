"""Local storage for original uploaded dataset files."""

from pathlib import Path
from uuid import uuid4


_DATASET_STORAGE_DIR = Path(__file__).resolve().parents[2] / ".data" / "datasets"


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
