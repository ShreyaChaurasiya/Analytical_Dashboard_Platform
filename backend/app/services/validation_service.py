"""Validation and preview generation for supported analytical data formats."""

import csv
import json
import logging
import sqlite3
import tempfile
from dataclasses import dataclass
from io import BytesIO, StringIO
from pathlib import Path

import pandas as pd


logger = logging.getLogger(__name__)
SUPPORTED_FILE_TYPES = {
    "csv",
    "tsv",
    "txt",
    "xlsx",
    "xls",
    "ods",
    "json",
    "jsonl",
    "xml",
    "parquet",
    "feather",
    "orc",
    "avro",
    "sas7bdat",
    "xpt",
    "sav",
    "dta",
    "dbf",
    "geojson",
    "sqlite",
    "sqlite3",
    "db",
    "ndjson",
}
MAX_DATASET_ROWS = 1_000_000
MAX_DATASET_COLUMNS = 500


@dataclass(frozen=True)
class DatasetPreview:
    headers: list[str]
    preview_rows: list[list[str]]
    row_count: int
    column_count: int
    missing_cells: int


def _read_sqlite(content: bytes) -> pd.DataFrame:
    connection = sqlite3.connect(":memory:")
    try:
        connection.deserialize(content)
        tables = connection.execute(
            "SELECT name FROM sqlite_master "
            "WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        ).fetchall()
        if not tables:
            raise ValueError("The SQLite file contains no user tables.")
        table_name = tables[0][0]
        quoted_name = '"' + table_name.replace('"', '""') + '"'
        return pd.read_sql_query(f"SELECT * FROM {quoted_name}", connection)
    finally:
        connection.close()


def _read_geojson(content: bytes) -> pd.DataFrame:
    document = json.loads(content.decode("utf-8-sig"))
    if document.get("type") != "FeatureCollection" or not isinstance(
        document.get("features"), list
    ):
        raise ValueError("GeoJSON uploads must contain a FeatureCollection.")

    records: list[dict[str, object]] = []
    for feature in document["features"]:
        if not isinstance(feature, dict) or feature.get("type") != "Feature":
            raise ValueError("The GeoJSON FeatureCollection contains an invalid feature.")
        properties = feature.get("properties") or {}
        if not isinstance(properties, dict):
            raise ValueError("GeoJSON feature properties must be objects.")
        record = dict(properties)
        if "geometry" in feature:
            record["geometry"] = json.dumps(feature["geometry"], separators=(",", ":"))
        records.append(record)

    return pd.DataFrame.from_records(records)


def _read_avro(content: bytes) -> pd.DataFrame:
    from fastavro import reader

    return pd.DataFrame.from_records(reader(BytesIO(content)))


def _read_dbf(content: bytes) -> pd.DataFrame:
    from dbfread import DBF

    with tempfile.TemporaryDirectory() as temporary_directory:
        dbf_path = Path(temporary_directory) / "dataset.dbf"
        dbf_path.write_bytes(content)
        return pd.DataFrame.from_records(list(DBF(str(dbf_path), load=True)))


def _read_pyreadstat(content: bytes, file_type: str) -> pd.DataFrame:
    import pyreadstat

    readers = {
        "sas7bdat": pyreadstat.read_sas7bdat,
        "xpt": pyreadstat.read_xport,
    }
    with tempfile.TemporaryDirectory() as temporary_directory:
        path = Path(temporary_directory) / f"dataset.{file_type}"
        path.write_bytes(content)
        dataframe, _ = readers[file_type](str(path))
        return dataframe


def _read_json(content: bytes) -> pd.DataFrame:
    document = json.loads(content.decode("utf-8-sig"))
    if isinstance(document, list):
        return pd.DataFrame.from_records(document)
    if isinstance(document, dict):
        if document and all(isinstance(value, list) for value in document.values()):
            return pd.DataFrame.from_dict(document)
        return pd.DataFrame([document])
    raise ValueError("JSON data must be an object, an array of objects, or columns of arrays.")


def _read_dataframe(content: bytes, file_type: str) -> pd.DataFrame:
    buffer = BytesIO(content)
    if file_type in {"csv", "tsv", "txt"}:
        text = content.decode("utf-8-sig")
        if file_type == "tsv":
            delimiter = "\t"
        elif file_type == "txt":
            try:
                delimiter = csv.Sniffer().sniff(text[:65536], delimiters=",\t;|").delimiter
            except csv.Error as error:
                raise ValueError("Delimited text needs comma, tab, semicolon, or pipe separators.") from error
        else:
            delimiter = ","
        return pd.read_csv(StringIO(text), sep=delimiter, dtype=str, keep_default_na=False)
    if file_type in {"xlsx", "xls", "ods"}:
        return pd.read_excel(buffer, sheet_name=0, dtype=str)
    if file_type == "json":
        return _read_json(content)
    if file_type in {"jsonl", "ndjson"}:
        return pd.read_json(buffer, lines=True)
    if file_type == "xml":
        return pd.read_xml(buffer, parser="etree")
    if file_type == "parquet":
        return pd.read_parquet(buffer)
    if file_type == "feather":
        return pd.read_feather(buffer)
    if file_type == "orc":
        return pd.read_orc(buffer)
    if file_type == "avro":
        return _read_avro(content)
    if file_type == "sas7bdat":
        return _read_pyreadstat(content, file_type)
    if file_type == "xpt":
        return _read_pyreadstat(content, file_type)
    if file_type == "sav":
        return pd.read_spss(buffer)
    if file_type == "dta":
        return pd.read_stata(buffer)
    if file_type == "dbf":
        return _read_dbf(content)
    if file_type == "geojson":
        return _read_geojson(content)
    if file_type in {"sqlite", "sqlite3", "db"}:
        return _read_sqlite(content)
    raise ValueError("This file format is not supported.")


def _cell_to_text(value: object) -> str:
    if pd.isna(value):
        return ""
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return str(value)


def load_dataset_dataframe(content: bytes, file_type: str) -> pd.DataFrame:
    normalized_type = file_type.lower().lstrip(".")
    if normalized_type not in SUPPORTED_FILE_TYPES:
        raise ValueError("This file format is not supported.")
    if not content:
        raise ValueError("The selected file is empty.")

    try:
        data = _read_dataframe(content, normalized_type)
    except (ValueError, UnicodeError):
        raise
    except Exception as error:
        logger.exception("Could not read uploaded %s dataset.", normalized_type)
        raise ValueError(
            f"Could not read this {normalized_type.upper()} file. Check that it is valid and not password-protected."
        ) from error

    if data.shape[0] == 0:
        raise ValueError("Add at least one data row after the column headings.")
    if data.shape[0] > MAX_DATASET_ROWS:
        raise ValueError(f"Files may contain at most {MAX_DATASET_ROWS:,} data rows.")
    if data.shape[1] == 0 or data.shape[1] > MAX_DATASET_COLUMNS:
        raise ValueError(f"Files must contain between 1 and {MAX_DATASET_COLUMNS} columns.")

    headers = [str(column).strip() for column in data.columns]
    if any(not header for header in headers):
        raise ValueError("Every column needs a name in the first row.")
    if len({header.casefold() for header in headers}) != len(headers):
        raise ValueError("Column names must be unique.")

    data.columns = headers
    return data


def parse_delimited_file(content: bytes, file_type: str) -> DatasetPreview:
    data = load_dataset_dataframe(content, file_type)
    headers = list(data.columns)
    missing_mask = data.isna() | data.map(
        lambda value: isinstance(value, str) and not value.strip()
    )
    missing_cells = int(missing_mask.sum().sum())
    preview_rows = [
        [_cell_to_text(value) for value in row]
        for row in data.head(10).itertuples(index=False, name=None)
    ]
    return DatasetPreview(
        headers=headers,
        preview_rows=preview_rows,
        row_count=len(data),
        column_count=len(headers),
        missing_cells=missing_cells,
    )
