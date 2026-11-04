"""Dataset API response shapes."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DatasetSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    original_filename: str
    file_type: str | None
    file_size: int | None
    status: str
    created_at: datetime
    row_count: int | None = None
    column_count: int | None = None
    missing_cells: int | None = None
    version_number: int | None = None


class DatasetDashboard(DatasetSummary):
    headers: list[str]
    preview_rows: list[list[str]]


class DatasetFilePreview(BaseModel):
    headers: list[str]
    preview_rows: list[list[str]]
    row_count: int
    column_count: int
    missing_cells: int
