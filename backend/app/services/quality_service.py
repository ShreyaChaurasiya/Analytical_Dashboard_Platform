"""Missing-value, duplicate-row, and numeric-outlier checks."""

import pandas as pd

from app.services.analysis_service import _missing_mask, _numeric_values


def find_quality_issues(data: pd.DataFrame) -> list[dict]:
    issues: list[dict] = []

    for column in data.columns:
        missing_count = int(_missing_mask(data[column]).sum())
        if missing_count:
            percentage = round(missing_count / len(data) * 100, 2)
            issues.append(
                {
                    "issue_type": "missing_values",
                    "column_name": str(column),
                    "severity": "high" if percentage >= 50 else "medium",
                    "affected_rows": missing_count,
                    "description": (
                        f"{missing_count} of {len(data)} rows "
                        f"({percentage}%) have a missing value."
                    ),
                    "details": {
                        "missing_count": missing_count,
                        "row_count": len(data),
                        "percentage": percentage,
                    },
                }
            )

    duplicate_count = int(data.duplicated().sum())
    if duplicate_count:
        issues.append(
            {
                "issue_type": "duplicate_rows",
                "column_name": None,
                "severity": "medium",
                "affected_rows": duplicate_count,
                "description": f"{duplicate_count} duplicate rows were found.",
                "details": {"duplicate_rows": duplicate_count},
            }
        )

    for column in data.columns:
        series = data[column]
        missing = _missing_mask(series)
        values = _numeric_values(series)
        if values.empty or values.isna().any() or len(values) < 4:
            continue

        first_quartile = float(values.quantile(0.25))
        third_quartile = float(values.quantile(0.75))
        interquartile_range = third_quartile - first_quartile
        if interquartile_range <= 0:
            continue

        lower_bound = first_quartile - 1.5 * interquartile_range
        upper_bound = third_quartile + 1.5 * interquartile_range
        outlier_mask = ~missing & (
            pd.to_numeric(series, errors="coerce").lt(lower_bound)
            | pd.to_numeric(series, errors="coerce").gt(upper_bound)
        )
        outlier_count = int(outlier_mask.sum())
        if outlier_count:
            issues.append(
                {
                    "issue_type": "numeric_outliers",
                    "column_name": str(column),
                    "severity": "low",
                    "affected_rows": outlier_count,
                    "description": (
                        f"{outlier_count} values fall outside the 1.5×IQR range."
                    ),
                    "details": {
                        "lower_bound": round(lower_bound, 6),
                        "upper_bound": round(upper_bound, 6),
                        "method": "1.5 times the interquartile range",
                    },
                }
            )

    return issues
