"""Assemble stored analysis and quality results for the dashboard API."""

from __future__ import annotations

from typing import Any


def _validate_context(
    dataset_id: str,
    dataset_version_id: str | None,
    analysis: dict[str, Any] | None,
    quality: dict[str, Any] | None,
) -> None:
    for name, result in (("Analysis", analysis), ("Quality results", quality)):
        if result is None:
            continue
        result_dataset_id = result.get("dataset_id")
        result_version_id = result.get("dataset_version_id")
        if result_dataset_id is not None and result_dataset_id != dataset_id:
            raise ValueError(f"{name} does not match the requested dataset.")
        if dataset_version_id and result_version_id and result_version_id != dataset_version_id:
            raise ValueError(f"{name} does not match the requested dataset version.")

    analysis_version = (analysis or {}).get("dataset_version_id")
    quality_version = (quality or {}).get("dataset_version_id")
    if analysis_version and quality_version and analysis_version != quality_version:
        raise ValueError("Analysis and quality results belong to different dataset versions.")


def build_dashboard_payload(
    dataset_id: str,
    analysis: dict[str, Any] | None,
    quality: dict[str, Any] | None,
    *,
    processing: dict[str, Any] | None = None,
    dataset_version_id: str | None = None,
    status: str = "completed",
    failures: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    """Build a compact dashboard response from one dataset-version context.

    This function performs no database reads. The API route will load the
    authorized user's saved results and pass those records here.
    """
    _validate_context(dataset_id, dataset_version_id, analysis, quality)

    row_count = (
        analysis.get("row_count") if analysis is not None else None
    )
    column_count = (
        analysis.get("column_count") if analysis is not None else None
    )
    missing_by_column = (quality or {}).get("missing_by_column", {})
    missing_cell_count = sum(
        int(summary.get("missing_count", 0))
        for summary in missing_by_column.values()
    )
    findings = (quality or {}).get("findings", [])

    return {
        "dataset_id": dataset_id,
        "dataset_version_id": dataset_version_id,
        "status": status,
        "summary": {
            "row_count": row_count,
            "column_count": column_count,
            "missing_cell_count": missing_cell_count,
            "duplicate_row_count": (quality or {}).get("duplicate_row_count", 0),
            "quality_finding_count": len(findings),
        },
        "analytical_types": (analysis or {}).get("analytical_types", {}),
        "column_roles": (processing or {}).get("column_roles", {}),
        "missing_marker_preview": (processing or {}).get("missing_marker_preview", {}),
        "applied_missing_markers": (processing or {}).get("applied_missing_markers", []),
        "columns": (analysis or {}).get("columns", {}),
        "correlations": (analysis or {}).get("correlations", []),
        "visualizations": (analysis or {}).get("chart_suggestions", []),
        "quality_findings": findings,
        "failures": failures or [],
    }
