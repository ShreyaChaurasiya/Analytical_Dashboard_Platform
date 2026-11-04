"""Validation and summary generation for CSV and TSV uploads."""

import csv
from dataclasses import dataclass
from io import StringIO


@dataclass(frozen=True)
class DatasetPreview:
    headers: list[str]
    preview_rows: list[list[str]]
    row_count: int
    column_count: int
    missing_cells: int


def parse_delimited_file(content: bytes, file_type: str) -> DatasetPreview:
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise ValueError("The file must use UTF-8 text encoding.") from error

    reader = csv.reader(StringIO(text, newline=""), delimiter="\t" if file_type == "tsv" else ",", strict=True)
    try:
        raw_headers = next(reader, [])
        headers = [value.strip() for value in raw_headers]
        if not headers or any(not value for value in headers):
            raise ValueError("Every column needs a name in the first row.")
        if len({value.casefold() for value in headers}) != len(headers):
            raise ValueError("Column names must be unique.")

        row_count = 0
        missing_cells = 0
        preview_rows: list[list[str]] = []
        for line_number, values in enumerate(reader, start=2):
            if not any(value.strip() for value in values):
                continue
            if len(values) > len(headers) and any(
                value.strip() for value in values[len(headers):]
            ):
                raise ValueError(
                    f"Row {line_number} has more values than the {len(headers)} column headings."
                )

            normalized = [
                values[index].strip() if index < len(values) else ""
                for index in range(len(headers))
            ]
            row_count += 1
            missing_cells += sum(not value for value in normalized)
            if len(preview_rows) < 10:
                preview_rows.append(normalized)
    except csv.Error as error:
        raise ValueError("The file contains invalid CSV/TSV formatting.") from error

    if not row_count:
        raise ValueError("Add at least one data row after the column headings.")

    return DatasetPreview(
        headers=headers,
        preview_rows=preview_rows,
        row_count=row_count,
        column_count=len(headers),
        missing_cells=missing_cells,
    )
