"""Descriptive statistics and inferred column types."""

import pandas as pd


def _missing_mask(series: pd.Series) -> pd.Series:
    return series.isna() | series.map(
        lambda value: isinstance(value, str) and not value.strip()
    )


def _numeric_values(series: pd.Series) -> pd.Series:
    values = series.loc[~_missing_mask(series)]
    return pd.to_numeric(values, errors="coerce")


def _column_type(series: pd.Series) -> tuple[str, pd.Series | None]:
    values = series.loc[~_missing_mask(series)]
    if values.empty:
        return "empty", None

    lowered = values.astype(str).str.strip().str.casefold()
    if lowered.isin({"true", "false", "yes", "no"}).all():
        return "boolean", None

    numeric = pd.to_numeric(values, errors="coerce")
    if numeric.notna().all():
        return "numeric", numeric

    dates = pd.to_datetime(values, errors="coerce", format="mixed", utc=True)
    if dates.notna().all():
        return "datetime", None

    return "categorical", None


def analyze_dataframe(data: pd.DataFrame) -> dict:
    columns = []
    numeric_data: dict[str, pd.Series] = {}
    missing_cells = 0

    for column in data.columns:
        series = data[column]
        missing_mask = _missing_mask(series)
        missing_count = int(missing_mask.sum())
        missing_cells += missing_count
        non_missing = series.loc[~missing_mask]
        inferred_type, numeric = _column_type(series)

        statistics = None
        if numeric is not None:
            numeric_data[str(column)] = numeric
            statistics = {
                "mean": round(float(numeric.mean()), 4),
                "median": round(float(numeric.median()), 4),
                "minimum": float(numeric.min()),
                "maximum": float(numeric.max()),
            }
            standard_deviation = numeric.std()
            if pd.notna(standard_deviation):
                statistics["standard_deviation"] = round(
                    float(standard_deviation), 4
                )

        top_values = [
            {"value": str(value), "count": int(count)}
            for value, count in non_missing.value_counts().head(5).items()
        ]
        columns.append(
            {
                "name": str(column),
                "inferred_type": inferred_type,
                "missing_count": missing_count,
                "unique_count": int(non_missing.nunique()),
                "statistics": statistics,
                "top_values": top_values,
            }
        )

    correlation_columns = list(numeric_data)[:20]
    correlations: dict[str, dict[str, float | None]] = {}
    if len(correlation_columns) > 1:
        numeric_frame = pd.DataFrame(
            {name: numeric_data[name] for name in correlation_columns}
        )
        matrix = numeric_frame.corr(min_periods=2)
        correlations = {
            column: {
                other: (
                    round(float(value), 4) if pd.notna(value) else None
                )
                for other, value in matrix[column].items()
            }
            for column in correlation_columns
        }

    return {
        "row_count": len(data),
        "column_count": len(data.columns),
        "missing_cells": missing_cells,
        "duplicate_rows": int(data.duplicated().sum()),
        "columns": columns,
        "correlations": correlations,
    }
