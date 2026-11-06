"""Small serialization helpers shared by dataset services."""

from datetime import date, datetime
from typing import Any


def json_safe_scalar(value: Any) -> Any:
    """Convert common Python and Polars scalar values to JSON-safe values."""
    if value is None:
        return None
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if hasattr(value, "item"):
        return json_safe_scalar(value.item())
    if isinstance(value, float) and (value != value or value in (float("inf"), float("-inf"))):
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    return str(value)
