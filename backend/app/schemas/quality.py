"""Dataset quality response shapes."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class QualityIssueResponse(BaseModel):
    id: int
    dataset_id: int
    analysis_id: int
    issue_type: str
    column_name: str | None
    severity: str
    affected_rows: int
    description: str
    details: dict[str, Any]
    created_at: datetime
