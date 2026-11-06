"""Orchestrate dataset processing for a background worker."""

from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

from app.services.analysis_service import summarize_dataset
from app.services.dataset_service import read_stored_dataset
from app.services.processing_service import (
    DEFAULT_MISSING_MARKERS,
    apply_numeric_roles,
    infer_column_roles,
    inspect_missing_markers,
    normalize_missing_values,
)
from app.services.quality_service import inspect_quality


logger = logging.getLogger(__name__)


def _job_result(
    dataset_id: str,
    dataset_version_id: str | None,
    status: str,
    *,
    row_count: int | None = None,
    column_count: int | None = None,
    analysis: dict[str, Any] | None = None,
    quality: dict[str, Any] | None = None,
    column_roles: dict[str, Any] | None = None,
    missing_marker_preview: dict[str, Any] | None = None,
    failures: list[dict[str, str]] | None = None,
    **additional_fields: Any,
) -> dict[str, Any]:
    return {
        "dataset_id": dataset_id,
        "dataset_version_id": dataset_version_id,
        "status": status,
        "row_count": row_count,
        "column_count": column_count,
        "analysis": analysis,
        "quality": quality,
        "column_roles": column_roles,
        "missing_marker_preview": missing_marker_preview,
        "failures": failures or [],
        **additional_fields,
    }


def _run_stage(
    dataset_id: str,
    stage: str,
    error_message: str,
    operation: Callable[[], Any],
    failures: list[dict[str, str]],
) -> Any | None:
    try:
        return operation()
    except Exception:
        logger.exception("Dataset %s stage failed", stage, extra={"dataset_id": dataset_id})
        failures.append({"stage": stage, "message": error_message})
        return None


def run_dataset_analysis(
    dataset_id: str,
    dataset_version_id: str | None = None,
    *,
    missing_markers: set[str] | None = None,
    analytical_type_overrides: dict[str, str] | None = None,
    approve_invalid_numeric_as_missing: set[str] | None = None,
    confirm_processing: bool = False,
    has_header: bool = True,
    delimiter: str | None = None,
    sheet_name: str | None = None,
) -> dict[str, Any]:
    """Run loading, missing-value normalization, quality, and analysis steps.

    This is the worker callable. A Celery task can invoke it and persist the
    returned result together with its job record when the database models are
    ready. Each analysis stage is isolated so one failure does not erase the
    other stage's result.
    """
    try:
        original = read_stored_dataset(
            dataset_id,
            has_header=has_header,
            delimiter=delimiter,
            sheet_name=sheet_name,
        )
    except Exception:
        logger.exception("Dataset loading failed", extra={"dataset_id": dataset_id})
        return _job_result(
            dataset_id,
            dataset_version_id,
            "failed",
            failures=[{"stage": "load", "message": "The dataset could not be read."}],
        )

    marker_preview = None
    column_roles = None
    try:
        marker_preview = inspect_missing_markers(original)
        applied_markers = {
            marker.strip().casefold()
            for marker in (DEFAULT_MISSING_MARKERS if missing_markers is None else missing_markers)
        }
        processed = normalize_missing_values(original, applied_markers)
        column_roles = infer_column_roles(processed, analytical_type_overrides)
        if not confirm_processing:
            return _job_result(
                dataset_id,
                dataset_version_id,
                "review_required",
                row_count=original.height,
                column_count=original.width,
                column_roles=column_roles,
                missing_marker_preview=marker_preview,
                proposed_missing_markers=sorted(applied_markers),
                applied_missing_markers=[],
                source_preserved=True,
            )
        processed, column_roles = apply_numeric_roles(
            processed,
            column_roles,
            approve_invalid_as_missing=approve_invalid_numeric_as_missing,
        )
        analytical_types = {
            name: details["analytical_type"]
            for name, details in column_roles.items()
        }
    except ValueError as exc:
        logger.info("Dataset processing options were rejected", extra={"dataset_id": dataset_id})
        return _job_result(
            dataset_id,
            dataset_version_id,
            "failed",
            row_count=original.height,
            column_count=original.width,
            column_roles=column_roles,
            missing_marker_preview=marker_preview,
            failures=[{"stage": "processing", "message": str(exc)}],
        )
    except Exception:
        logger.exception("Dataset preparation failed", extra={"dataset_id": dataset_id})
        return _job_result(
            dataset_id,
            dataset_version_id,
            "failed",
            row_count=original.height,
            column_count=original.width,
            column_roles=column_roles,
            missing_marker_preview=marker_preview,
            failures=[{"stage": "processing", "message": "The dataset could not be prepared."}],
        )

    failures: list[dict[str, str]] = []
    analysis = _run_stage(
        dataset_id,
        "analysis",
        "Descriptive analysis could not complete.",
        lambda: summarize_dataset(
            processed,
            analytical_types=analytical_types,
            dataset_id=dataset_id,
            dataset_version_id=dataset_version_id,
        ),
        failures,
    )
    quality = _run_stage(
        dataset_id,
        "quality",
        "Data-quality checks could not complete.",
        lambda: inspect_quality(
            processed,
            analytical_types=analytical_types,
        ),
        failures,
    )

    if analysis is not None and quality is not None:
        status = "completed"
    elif analysis is not None or quality is not None:
        status = "partial"
    else:
        status = "failed"

    return _job_result(
        dataset_id,
        dataset_version_id,
        status,
        row_count=processed.height,
        column_count=processed.width,
        analysis=analysis,
        quality=quality,
        column_roles=column_roles,
        missing_marker_preview=marker_preview,
        failures=failures,
        applied_missing_markers=sorted(applied_markers),
        approved_invalid_numeric_as_missing=sorted(approve_invalid_numeric_as_missing or set()),
        processing_confirmed=True,
        source_preserved=True,
    )
