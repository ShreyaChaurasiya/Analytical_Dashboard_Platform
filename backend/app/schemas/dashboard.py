"""Dashboard export request and response shapes."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class DashboardExportCreate(BaseModel):
    dataset_id: int | None = Field(default=None, ge=1)
    time_range: Literal["all", "7", "30"] = "all"


class DashboardExportSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    file_name: str
    created_at: datetime
