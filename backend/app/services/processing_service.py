"""Prepare a processed copy and infer column roles before analysis."""

from __future__ import annotations

import re
from typing import Any, Literal

import polars as pl


AnalyticalType = Literal[
    "numeric", "categorical", "boolean", "datetime", "identifier", "free_text", "unresolved"
]
ALLOWED_ANALYTICAL_TYPES = {
    "numeric", "categorical", "boolean", "datetime", "identifier", "free_text", "unresolved"
}
DEFAULT_MISSING_MARKERS = {"", "n/a", "null", "none", "nan", "<na>"}
AMBIGUOUS_MISSING_MARKERS = {"na"}
IDENTIFIER_NAME_PARTS = {"id", "uuid", "code", "key"}
MAX_CATEGORY_COUNT = 20
HIGH_CARDINALITY_RATIO = 0.8
FREE_TEXT_MIN_AVERAGE_LENGTH = 40
SAMPLE_VALUE_COUNT = 5


def validate_analytical_types(
    frame: pl.DataFrame,
    analytical_types: dict[str, str] | None,
    *,
    label: str = "Analytical types",
) -> None:
    """Reject role mappings that refer to missing columns or unsupported types."""
    if analytical_types is None:
        return
    unknown_columns = set(analytical_types) - set(frame.columns)
    if unknown_columns:
        raise ValueError(f"{label} reference unknown columns: {sorted(unknown_columns)}")
    invalid_types = {
        kind for kind in analytical_types.values()
        if kind not in ALLOWED_ANALYTICAL_TYPES
    }
    if invalid_types:
        raise ValueError(f"Unsupported analytical types: {sorted(map(str, invalid_types))}")


def _is_string_type(dtype: pl.DataType) -> bool:
    return dtype.base_type() in (pl.String, pl.Categorical, pl.Enum)


def _normalized_string(column: str) -> pl.Expr:
    return pl.col(column).cast(pl.String).str.strip_chars().str.to_lowercase()


def inspect_missing_markers(frame: pl.DataFrame) -> dict[str, Any]:
    """Count known missing markers without changing any values.

    ``NA`` is returned as ambiguous for review; it is not normalized by
    default because it can also be a valid category such as a country code.
    """
    markers = DEFAULT_MISSING_MARKERS | AMBIGUOUS_MISSING_MARKERS
    string_columns = [name for name, dtype in frame.schema.items() if _is_string_type(dtype)]
    expressions = []
    aliases: dict[str, tuple[str, str]] = {}
    for column_index, name in enumerate(string_columns):
        normalized = _normalized_string(name)
        for marker_index, marker in enumerate(sorted(markers)):
            alias = f"__adp_marker_{column_index}_{marker_index}"
            expressions.append((normalized == marker).sum().alias(alias))
            aliases[alias] = (name, marker)

    counts = frame.select(expressions).row(0, named=True) if expressions and frame.height else {}
    columns: dict[str, list[dict[str, Any]]] = {}
    for alias, (name, marker) in aliases.items():
        count = int(counts.get(alias, 0) or 0)
        if count:
            columns.setdefault(name, []).append({
                "marker": marker or "(blank)",
                "count": count,
                "ambiguous": marker in AMBIGUOUS_MISSING_MARKERS,
                "normalized_by_default": marker in DEFAULT_MISSING_MARKERS,
            })
    return {"columns": columns, "ambiguous_markers": sorted(AMBIGUOUS_MISSING_MARKERS)}


def normalize_missing_values(
    frame: pl.DataFrame,
    markers: set[str] | None = None,
) -> pl.DataFrame:
    """Normalize selected string markers to null in a new processed frame."""
    selected = (
        DEFAULT_MISSING_MARKERS
        if markers is None
        else {marker.strip().casefold() for marker in markers}
    )
    unknown = selected - DEFAULT_MISSING_MARKERS - AMBIGUOUS_MISSING_MARKERS
    if unknown:
        raise ValueError(f"Unknown missing-value markers: {sorted(unknown)}")
    if not selected:
        return frame.clone()

    string_columns = [name for name, dtype in frame.schema.items() if _is_string_type(dtype)]
    if not string_columns:
        return frame.clone()
    return frame.with_columns(
        pl.when(_normalized_string(name).is_in(sorted(selected)))
        .then(None)
        .otherwise(pl.col(name))
        .alias(name)
        for name in string_columns
    )


def _numeric_text_diagnostics(frame: pl.DataFrame, name: str) -> dict[str, Any]:
    """Check whether non-missing text parses as numbers and sample bad rows."""
    row_name = "__adp_row_index"
    while row_name in frame.columns:
        row_name = f"_{row_name}"
    raw = pl.col(name).cast(pl.String).str.strip_chars()
    parsed = raw.cast(pl.Float64, strict=False)
    invalid = pl.col(name).is_not_null() & parsed.is_null()
    inspected = frame.with_row_index(row_name).select(
        pl.col(name).is_not_null().sum().alias("non_missing_count"),
        parsed.count().alias("numeric_count"),
        invalid.sum().alias("failure_count"),
        (pl.col(row_name).filter(invalid).head(5) + 1).implode().alias("failure_rows"),
        pl.col(name).filter(invalid).head(5).implode().alias("failure_examples"),
    ).row(0, named=True)
    return inspected


def apply_numeric_roles(
    frame: pl.DataFrame,
    column_roles: dict[str, dict[str, Any]],
    *,
    approve_invalid_as_missing: set[str] | None = None,
) -> tuple[pl.DataFrame, dict[str, dict[str, Any]]]:
    """Cast numeric text in a derived frame; invalid values need explicit approval."""
    approved = approve_invalid_as_missing or set()
    selected_types = {
        name: details.get("analytical_type")
        for name, details in column_roles.items()
    }
    validate_analytical_types(frame, selected_types, label="Column roles")
    numeric_text_columns = {
        name for name, details in column_roles.items()
        if details.get("analytical_type") == "numeric" and _is_string_type(frame.schema[name])
    }
    unknown_columns = approved - set(frame.columns)
    if unknown_columns:
        raise ValueError(f"Numeric-cleaning approvals reference unknown columns: {sorted(unknown_columns)}")
    if approved - numeric_text_columns:
        raise ValueError("Approve invalid-as-missing only for columns selected as numeric text.")

    expressions = []
    updated_roles = {name: dict(details) for name, details in column_roles.items()}
    for name, details in updated_roles.items():
        if details["analytical_type"] != "numeric" or not _is_string_type(frame.schema[name]):
            continue
        diagnostics = None
        if "numeric_parse_failures" not in details:
            diagnostics = _numeric_text_diagnostics(frame, name)
        failure_count = int(
            details.get("numeric_parse_failures", (diagnostics or {}).get("failure_count", 0)) or 0
        )
        if failure_count:
            details["numeric_parse_failures"] = failure_count
            details["numeric_parse_failure_rows"] = (
                details.get("numeric_parse_failure_rows")
                or (diagnostics or {}).get("failure_rows")
                or []
            )
            details["numeric_parse_failure_examples"] = (
                details.get("numeric_parse_failure_examples")
                or [
                    str(value)[:120]
                    for value in ((diagnostics or {}).get("failure_examples") or [])
                ]
            )
        if failure_count and name not in approved:
            details["analytical_type"] = "unresolved"
            details["confidence"] = "low"
            details["reason"] = "Some values do not parse as numbers; review them before analysis."
            continue

        raw = pl.col(name).cast(pl.String).str.strip_chars()
        expressions.append(raw.cast(pl.Float64, strict=False).alias(name))
        if failure_count:
            details["invalid_values_converted_to_missing"] = True
            details["reason"] = "Numeric conversion applied with approval to treat invalid values as missing."
    processed = frame.with_columns(expressions) if expressions else frame.clone()
    return processed, updated_roles


def infer_column_roles(
    frame: pl.DataFrame,
    overrides: dict[str, str] | None = None,
) -> dict[str, dict[str, Any]]:
    """Infer a role, confidence, reason, and safe preview values per column.

    Overrides are accepted for compatible storage types. Ambiguous string
    columns remain unresolved until a user selects a role.
    """
    overrides = overrides or {}
    validate_analytical_types(frame, overrides, label="Overrides")

    roles: dict[str, dict[str, Any]] = {}
    for name, dtype in frame.schema.items():
        base_type = dtype.base_type()
        normalized_name = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", name).casefold()
        identifier_name = normalized_name.split("_")[-1] in IDENTIFIER_NAME_PARTS
        samples = [str(value)[:120] for value in frame.get_column(name).drop_nulls().head(SAMPLE_VALUE_COUNT).to_list()]

        if base_type == pl.Boolean:
            role, confidence, reason = "boolean", "high", "Native Boolean column."
        elif dtype.is_numeric() and identifier_name:
            role, confidence, reason = "identifier", "medium", "Numeric column name ends with an identifier term."
        elif dtype.is_numeric():
            role, confidence, reason = "numeric", "high", "Native numeric column."
        elif base_type in (pl.Date, pl.Datetime):
            role, confidence, reason = "datetime", "high", "Native date/time column."
        elif _is_string_type(dtype):
            values = frame.get_column(name).cast(pl.String).drop_nulls()
            count = values.len()
            unique_count = values.n_unique()
            unique_ratio = unique_count / max(count, 1)
            average_length = (
                values.str.len_chars().mean() or 0
            ) if count else 0
            numeric_check = _numeric_text_diagnostics(frame, name)
            numeric_count = int(numeric_check["numeric_count"] or 0)
            numeric_failures = int(numeric_check["failure_count"] or 0)
            if not count:
                role, confidence, reason = "unresolved", "low", "Column has no non-missing values."
            elif numeric_count and not numeric_failures:
                role, confidence, reason = "unresolved", "medium", "All values parse as numbers; confirm whether they are measurements or category codes."
            elif numeric_count and numeric_failures:
                role, confidence, reason = "unresolved", "low", "Some values look numeric but others fail numeric parsing."
            elif identifier_name and unique_ratio >= HIGH_CARDINALITY_RATIO:
                role, confidence, reason = "identifier", "medium", "Identifier-like name with mostly unique values."
            elif unique_count <= MAX_CATEGORY_COUNT and unique_ratio < HIGH_CARDINALITY_RATIO:
                role, confidence, reason = "categorical", "high", "Repeated string values with manageable cardinality."
            elif unique_ratio >= HIGH_CARDINALITY_RATIO and average_length >= FREE_TEXT_MIN_AVERAGE_LENGTH:
                role, confidence, reason = "free_text", "medium", "Long, mostly unique strings look like free text."
            else:
                role, confidence, reason = "unresolved", "low", "String values are too varied to classify safely."
        else:
            role, confidence, reason = "unresolved", "low", "Unsupported or nested storage type."

        if name in overrides:
            selected = overrides[name]
            compatible = (
                selected == "unresolved"
                or selected == "identifier" and (dtype.is_numeric() or _is_string_type(dtype))
                or selected == "free_text" and _is_string_type(dtype)
                or selected == "numeric" and (dtype.is_numeric() or _is_string_type(dtype))
                or selected == "boolean" and base_type == pl.Boolean
                or selected == "datetime" and base_type in (pl.Date, pl.Datetime)
                or selected == "categorical" and (
                    dtype.is_numeric()
                    or _is_string_type(dtype)
                    or base_type in (pl.Boolean, pl.Date, pl.Datetime)
                )
            )
            if not compatible:
                raise ValueError(f"Column '{name}' cannot use analytical type '{selected}' without a compatible storage type.")
            role, confidence, reason = selected, "user", "Selected by the user."

        roles[name] = {
            "storage_type": str(dtype),
            "analytical_type": role,
            "confidence": confidence,
            "reason": reason,
            "sample_values": samples,
        }
        if _is_string_type(dtype) and numeric_count and not numeric_failures:
            roles[name]["suggested_type"] = "numeric"
        if _is_string_type(dtype) and (
            (numeric_count and numeric_failures)
            or overrides.get(name) == "numeric"
        ):
            roles[name]["numeric_parse_failures"] = numeric_failures
            roles[name]["numeric_parse_failure_rows"] = numeric_check["failure_rows"] or []
            roles[name]["numeric_parse_failure_examples"] = [
                str(value)[:120] for value in (numeric_check["failure_examples"] or [])
            ]
    return roles


def infer_analytical_types(
    frame: pl.DataFrame,
    overrides: dict[str, str] | None = None,
) -> dict[str, AnalyticalType]:
    """Return only the column-to-role mapping expected by analysis services."""
    return {
        name: details["analytical_type"]
        for name, details in infer_column_roles(frame, overrides).items()
    }
