"""PDF and Excel report generation from stored analysis results."""

from io import BytesIO
from xml.sax.saxutils import escape as escape_xml

import pandas as pd
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


def _column_rows(results: dict) -> list[dict]:
    rows = []
    for column in results.get("columns", []):
        statistics = column.get("statistics") or {}
        rows.append(
            {
                "Column": column["name"],
                "Type": column["inferred_type"],
                "Missing": column["missing_count"],
                "Unique": column["unique_count"],
                "Mean": statistics.get("mean"),
                "Minimum": statistics.get("minimum"),
                "Maximum": statistics.get("maximum"),
                "Top values": ", ".join(
                    f"{item['value']} ({item['count']})"
                    for item in column.get("top_values", [])
                ),
            }
        )
    return rows


def _excel_safe(value):
    if isinstance(value, str) and value.startswith(("=", "+", "-", "@")):
        return "'" + value
    return value


def _pdf_safe(value) -> str:
    return str(value).encode("cp1252", "replace").decode("cp1252")


def _build_excel_report(dataset_name: str, analysis: dict, issues: list[dict]) -> bytes:
    output = BytesIO()
    summary = pd.DataFrame(
        [
            {"Metric": "Dataset", "Value": dataset_name},
            {"Metric": "Rows", "Value": analysis["row_count"]},
            {"Metric": "Columns", "Value": analysis["column_count"]},
            {"Metric": "Missing cells", "Value": analysis["missing_cells"]},
            {"Metric": "Duplicate rows", "Value": analysis["duplicate_rows"]},
        ]
    )
    columns = pd.DataFrame(_column_rows(analysis))
    findings = pd.DataFrame(
        [
            {
                "Type": issue["issue_type"],
                "Column": issue["column_name"] or "All columns",
                "Severity": issue["severity"],
                "Affected rows": issue["affected_rows"],
                "Description": issue["description"],
            }
            for issue in issues
        ],
        columns=["Type", "Column", "Severity", "Affected rows", "Description"],
    )
    for dataframe in (summary, columns, findings):
        for column in dataframe.select_dtypes(include="object"):
            dataframe[column] = dataframe[column].map(_excel_safe)

    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        summary.to_excel(writer, sheet_name="Summary", index=False)
        columns.to_excel(writer, sheet_name="Column analysis", index=False)
        findings.to_excel(writer, sheet_name="Quality findings", index=False)
    return output.getvalue()


def _build_pdf_report(dataset_name: str, analysis: dict, issues: list[dict]) -> bytes:
    output = BytesIO()
    document = SimpleDocTemplate(
        output,
        pagesize=landscape(letter),
        rightMargin=0.5 * inch,
        leftMargin=0.5 * inch,
        topMargin=0.5 * inch,
        bottomMargin=0.5 * inch,
    )
    styles = getSampleStyleSheet()
    body_style = styles["BodyText"]
    body_style.alignment = TA_LEFT
    story = [
        Paragraph("Analytical Dashboard Report", styles["Title"]),
        Paragraph(escape_xml(_pdf_safe(dataset_name)), styles["Heading2"]),
        Paragraph(
            f"Rows: {analysis['row_count']:,} | Columns: {analysis['column_count']} | "
            f"Missing cells: {analysis['missing_cells']:,} · "
            f"Duplicate rows: {analysis['duplicate_rows']:,}",
            body_style,
        ),
        Spacer(1, 0.2 * inch),
        Paragraph("Column analysis", styles["Heading2"]),
    ]

    header = ["Column", "Type", "Missing", "Unique", "Mean", "Minimum", "Maximum"]
    table_data = [header]
    for row in _column_rows(analysis):
        table_data.append(
            [
                Paragraph(escape_xml(_pdf_safe(row["Column"])), body_style),
                row["Type"],
                row["Missing"],
                row["Unique"],
                row["Mean"] if row["Mean"] is not None else "-",
                row["Minimum"] if row["Minimum"] is not None else "-",
                row["Maximum"] if row["Maximum"] is not None else "-",
            ]
        )
    story.append(
        Table(
            table_data,
            repeatRows=1,
            colWidths=[2.5 * inch, 1.1 * inch, 0.8 * inch, 0.8 * inch, 1 * inch, 1 * inch, 1 * inch],
            style=TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eaf1f6")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#20364b")),
                    ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#d5dee7")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("PADDING", (0, 0), (-1, -1), 6),
                ]
            ),
        )
    )

    story.extend([Spacer(1, 0.2 * inch), Paragraph("Quality findings", styles["Heading2"])])
    if issues:
        issue_rows = [["Type", "Column", "Severity", "Affected rows", "Description"]]
        issue_rows.extend(
            [
                issue["issue_type"],
                issue["column_name"] or "All columns",
                issue["severity"],
                issue["affected_rows"],
                Paragraph(escape_xml(_pdf_safe(issue["description"])), body_style),
            ]
            for issue in issues
        )
    else:
        issue_rows = [["No quality issues were detected."]]
    story.append(
        Table(
            issue_rows,
            repeatRows=1 if issues else 0,
            colWidths=[1.4 * inch, 1.4 * inch, 1 * inch, 1 * inch, 4.4 * inch]
            if issues
            else [9.2 * inch],
            style=TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eaf1f6")),
                    ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#d5dee7")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("PADDING", (0, 0), (-1, -1), 6),
                ]
            ),
        )
    )
    document.build(story)
    return output.getvalue()


def generate_report(
    file_format: str,
    dataset_name: str,
    analysis: dict,
    issues: list[dict],
) -> bytes:
    if file_format == "xlsx":
        return _build_excel_report(dataset_name, analysis, issues)
    if file_format == "pdf":
        return _build_pdf_report(dataset_name, analysis, issues)
    raise ValueError("Report format must be PDF or XLSX.")
