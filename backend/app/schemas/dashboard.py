"""Dashboard export request and response shapes."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


DashboardWidget = Literal[
    "value-distribution",
    "numeric-profile",
    "missing-values",
    "column-overview",
    "insights",
    "correlations",
]


class DashboardLayoutUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=120)
    visible_widgets: list[DashboardWidget] = Field(min_length=1, max_length=6)
    category_column: str | None = Field(default=None, max_length=255)
    numeric_column: str | None = Field(default=None, max_length=255)
    distribution_chart: Literal["bar", "column", "pie", "donut"] = "bar"

    @field_validator("title")
    @classmethod
    def reject_blank_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("The dashboard title cannot be blank.")
        return value

    @field_validator("visible_widgets")
    @classmethod
    def reject_duplicate_widgets(cls, value: list[DashboardWidget]) -> list[DashboardWidget]:
        if len(set(value)) != len(value):
            raise ValueError("Dashboard widgets must be unique.")
        return value


class DashboardLayout(DashboardLayoutUpdate):
    pass


class DashboardExportCreate(BaseModel):
    dataset_id: int | None = Field(default=None, ge=1)
    time_range: Literal["all", "7", "30"] = "all"


class DashboardExportSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    file_name: str
    created_at: datetime
