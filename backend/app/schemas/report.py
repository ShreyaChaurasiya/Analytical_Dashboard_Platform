"""Report API request and response shapes."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


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
