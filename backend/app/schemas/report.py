"""Report API request and response shapes."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.analysis import AnalysisColumn


class ReportCreate(BaseModel):
    format: str = Field(default="pdf", pattern="^(pdf|xlsx)$")


class ReportSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    dataset_id: int
    analysis_id: int
    format: str
    created_at: datetime
    dataset_name: str


class ReportQualityIssue(BaseModel):
    issue_type: str
    column_name: str | None
    severity: str
    affected_rows: int
    description: str


class ReportPreview(ReportSummary):
    row_count: int
    column_count: int
    missing_cells: int
    duplicate_rows: int
    columns: list[AnalysisColumn]
    quality_issues: list[ReportQualityIssue]
