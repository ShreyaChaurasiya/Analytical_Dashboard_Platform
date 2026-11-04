"""Analysis API response shapes."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class AnalysisColumn(BaseModel):
    name: str
    inferred_type: str
    missing_count: int
    unique_count: int
    statistics: dict[str, float] | None = None
    top_values: list[dict[str, Any]]


class AnalysisResults(BaseModel):
    row_count: int
    column_count: int
    missing_cells: int
    duplicate_rows: int
    columns: list[AnalysisColumn]
    correlations: dict[str, dict[str, float | None]]


class AnalysisResponse(BaseModel):
    id: int
    dataset_id: int
    dataset_version_id: int
    created_at: datetime
    quality_issue_count: int
    results: AnalysisResults
