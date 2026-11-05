import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE_URL, apiRequest } from "../api/client";

function Reports() {
    const [datasets, setDatasets] = useState([]);
    const [reports, setReports] = useState([]);
    const [datasetId, setDatasetId] = useState("");
    const [format, setFormat] = useState("pdf");
    const [reportPendingDelete, setReportPendingDelete] = useState(null);
    const [deletingReportId, setDeletingReportId] = useState(null);
    const [previewReport, setPreviewReport] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const [previewUrl, setPreviewUrl] = useState("");
    const [previewingReportId, setPreviewingReportId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
    }, [previewUrl]);

    useEffect(() => {
        let isCurrent = true;
        const token = window.localStorage.getItem("adp-access-token");

        Promise.all([
            apiRequest("/api/datasets", { token }),
            apiRequest("/api/reports", { token }),
            apiRequest("/api/settings", { token }),
        ])
            .then(([datasetRows, reportRows, settings]) => {
                if (!isCurrent) return;
                setDatasets(datasetRows);
                setReports(reportRows);
                setFormat(settings.dashboard_report_format);
                setDatasetId((current) => (
                    datasetRows.some((item) => String(item.id) === current)
                        ? current
                        : (datasetRows.length ? String(datasetRows[0].id) : "")
                ));
            })
            .catch((loadError) => {
                if (isCurrent) setError(loadError.message || "Reports could not be loaded.");
            })
            .finally(() => {
                if (isCurrent) setIsLoading(false);
            });

        return () => {
            isCurrent = false;
        };
    }, []);

    const generateReport = async (event) => {
        event.preventDefault();
        if (!datasetId) return;

        setIsGenerating(true);
        setError("");
        setMessage("");
        try {
            const report = await apiRequest(
                `/api/reports/datasets/${encodeURIComponent(datasetId)}/reports`,
                {
                    method: "POST",
                    token: window.localStorage.getItem("adp-access-token"),
                    body: JSON.stringify({ format }),
                },
            );
            setReports((current) => [report, ...current]);
            await openReportPreview(report);
        } catch (generateError) {
            setError(generateError.message || "The report could not be generated.");
        } finally {
            setIsGenerating(false);
        }
    };

    const openReportPreview = async (report) => {
        setPreviewingReportId(report.id);
        setError("");
        setMessage("");
        setPreviewReport(null);
        setPreviewData(null);
        setPreviewUrl("");
        try {
            const token = window.localStorage.getItem("adp-access-token");
            const preview = await apiRequest(
                `/api/reports/reports/${encodeURIComponent(report.id)}/preview`,
                { token },
            );
            setPreviewData(preview);

            if (report.format === "pdf") {
                const response = await fetch(
                    `${API_BASE_URL}/api/reports/reports/${encodeURIComponent(report.id)}/download`,
                    { headers: { Authorization: `******"adp-access-token")}` } },
                );
                if (!response.ok) {
                    const result = await response.json().catch(() => ({}));
                    throw new Error(result.detail || "The report preview could not be loaded.");
                }
                setPreviewUrl(URL.createObjectURL(await response.blob()));
            }
            setPreviewReport(report);
        } catch (previewError) {
            setError(previewError.message || "The report preview could not be loaded.");
        } finally {
            setPreviewingReportId(null);
        }
    };

    const downloadReport = async (report) => {
        setError("");
        setMessage("");
        try {
            const response = await fetch(
                `${API_BASE_URL}/api/reports/reports/${encodeURIComponent(report.id)}/download`,
                {
                    headers: {
                        Authorization: `Bearer ${window.localStorage.getItem("adp-access-token")}`,
                    },
                },
            );
            if (!response.ok) {
                const result = await response.json().catch(() => ({}));
                throw new Error(result.detail || "The report could not be downloaded.");
            }

            const url = URL.createObjectURL(await response.blob());
            const link = document.createElement("a");
            link.href = url;
            link.download = `adp-dataset-${report.dataset_id}-report-${report.id}.${report.format}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            setMessage("A copy was downloaded to your device. The stored report remains available here until deleted.");
        } catch (downloadError) {
            setError(downloadError.message || "The report could not be downloaded.");
        }
    };

    const deleteReport = async () => {
        if (!reportPendingDelete) return;
        const report = reportPendingDelete;
        setDeletingReportId(report.id);
        setError("");
        setMessage("");
        try {
            await apiRequest(`/api/reports/reports/${encodeURIComponent(report.id)}`, {
                method: "DELETE",
                token: window.localStorage.getItem("adp-access-token"),
            });
            setReports((current) => current.filter((item) => item.id !== report.id));
            if (previewReport?.id === report.id) {
                setPreviewReport(null);
                setPreviewData(null);
                setPreviewUrl("");
            }
            setReportPendingDelete(null);
            setMessage("The report and its stored server copy were deleted. Any file already downloaded to your device remains there.");
        } catch (deleteError) {
            setError(deleteError.message || "The report could not be deleted.");
        } finally {
            setDeletingReportId(null);
        }
    };

    const reportsThisMonth = reports.filter((report) => {
        const createdAt = new Date(report.created_at);
        const now = new Date();
        return createdAt.getFullYear() === now.getFullYear()
            && createdAt.getMonth() === now.getMonth();
    }).length;
    const lastGenerated = reports.length
        ? new Date(reports[0].created_at).toLocaleString()
        : "None yet";

    return (
        <main className="reports-page">
            <div className="reports-heading">
                <div>
                    <p className="dashboard-eyebrow">WORKSPACE / REPORTS</p>
                    <h1>Generated reports</h1>
                    <p>Generate a report, review its contents here, then choose whether to download it. Reports remain available here until deleted.</p>
                </div>
                <Link className="reports-back-link" to="/dashboard">Back to dashboard</Link>
            </div>

            <section className="reports-create" aria-label="Create a report">
                <h2>Create a report</h2>
                <form className="reports-create-form" onSubmit={generateReport}>
                    <label className="reports-field">
                        Dataset
                        <select
                            aria-label="Dataset for report"
                            value={datasetId}
                            onChange={(event) => setDatasetId(event.target.value)}
                            disabled={isLoading || !datasets.length}
                        >
                            {datasets.length
                                ? datasets.map((dataset) => (
                                    <option value={dataset.id} key={dataset.id}>{dataset.name}</option>
                                ))
                                : <option value="">No datasets available</option>}
                        </select>
                    </label>
                    <label className="reports-field">
                        Format
                        <select
                            aria-label="Report format"
                            value={format}
                            onChange={(event) => setFormat(event.target.value)}
                        >
                            <option value="pdf">PDF</option>
                            <option value="xlsx">Excel (.xlsx)</option>
                        </select>
                    </label>
                    <button
                        className="workspace-primary-button"
                        type="submit"
                        disabled={isLoading || isGenerating || !datasetId}
                    >
                        {isGenerating ? "Generating..." : "Generate and preview"}
                    </button>
                </form>
                {!isLoading && !datasets.length && (
                    <p className="reports-guidance">Upload a dataset before creating a report. <Link to="/upload">Upload dataset</Link></p>
                )}
            </section>

            {error && (
                <p className="reports-status" role="alert">
                    {error}{" "}
                    {error.toLowerCase().includes("run an analysis") && (
                        <Link to="/dashboard">Run analysis from the dashboard.</Link>
                    )}
                </p>
            )}
            {message && <p className="reports-status" role="status">{message}</p>}

            {previewReport && previewData && (
                <section className="report-preview" aria-labelledby="report-preview-heading">
                    <div className="report-preview-heading">
                        <div>
                            <p className="dashboard-eyebrow">REPORT PREVIEW</p>
                            <h2 id="report-preview-heading">{previewData.dataset_name}</h2>
                            <p>{previewData.format.toUpperCase()} · {previewData.row_count.toLocaleString()} rows · {previewData.column_count} columns</p>
                        </div>
                        <div className="report-preview-actions">
                            <button type="button" className="workspace-primary-button" onClick={() => downloadReport(previewReport)}>Download report</button>
                            <button type="button" className="report-preview-close" onClick={() => { setPreviewReport(null); setPreviewData(null); setPreviewUrl(""); }}>Close preview</button>
                        </div>
                    </div>
                    {previewReport.format === "pdf" && previewUrl ? (
                        <iframe className="report-pdf-preview" src={previewUrl} title={`PDF report preview for ${previewData.dataset_name}`} />
                    ) : (
                        <div className="report-document-preview">
                            <div className="report-preview-metrics">
                                <div><span>Rows</span><strong>{previewData.row_count.toLocaleString()}</strong></div>
                                <div><span>Columns</span><strong>{previewData.column_count}</strong></div>
                                <div><span>Missing cells</span><strong>{previewData.missing_cells.toLocaleString()}</strong></div>
                                <div><span>Duplicate rows</span><strong>{previewData.duplicate_rows.toLocaleString()}</strong></div>
                            </div>
                            <h3>Column analysis</h3>
                            <div className="report-preview-table-wrap"><table className="report-preview-table">
                                <thead><tr><th>Column</th><th>Type</th><th>Missing</th><th>Unique</th><th>Mean</th><th>Minimum</th><th>Maximum</th><th>Top values</th></tr></thead>
                                <tbody>{previewData.columns.map((column) => (
                                    <tr key={column.name}>
                                        <td>{column.name}</td><td>{column.inferred_type}</td><td>{column.missing_count}</td><td>{column.unique_count}</td>
                                        <td>{column.statistics?.mean ?? "—"}</td><td>{column.statistics?.minimum ?? "—"}</td><td>{column.statistics?.maximum ?? "—"}</td>
                                        <td>{column.top_values.map((item) => `${item.value} (${item.count})`).join(", ") || "—"}</td>
                                    </tr>
                                ))}</tbody>
                            </table></div>
                            <h3>Quality findings</h3>
                            {previewData.quality_issues.length ? (
                                <ul className="report-preview-findings">{previewData.quality_issues.map((issue, index) => (
                                    <li key={`${issue.issue_type}-${issue.column_name}-${index}`}><strong>{issue.severity}</strong> · {issue.description}</li>
                                ))}</ul>
                            ) : <p>No quality issues were detected.</p>}
                            <p className="report-preview-note">This is a content preview of the Excel workbook. Download the report to open its formatted worksheets.</p>
                        </div>
                    )}
                </section>
            )}

            <section className="reports-summary" aria-label="Report summary">
                <div><span>Available reports</span><strong>{reports.length}</strong></div>
                <div><span>Generated this month</span><strong>{reportsThisMonth}</strong></div>
                <div><span>Last generated</span><strong>{lastGenerated}</strong></div>
            </section>

            {isLoading ? (
                <p className="reports-status" role="status">Loading reports...</p>
            ) : reports.length ? (
                <section className="reports-list" aria-label="Available reports">
                    {reports.map((report) => (
                        <article className="report-card" key={report.id}>
                            <div className="report-card-icon" aria-hidden="true">
                                {report.format === "pdf" ? "P" : "X"}
                            </div>
                            <div>
                                <span className="report-card-type">{report.format.toUpperCase()} REPORT</span>
                                <h2>{report.dataset_name}</h2>
                                <p>Generated {new Date(report.created_at).toLocaleString()}</p>
                            </div>
                            <span className="report-ready">Ready</span>
                            <div className="report-card-actions">
                                <button type="button" onClick={() => openReportPreview(report)} disabled={previewingReportId === report.id}>
                                    {previewingReportId === report.id ? "Loading…" : "Preview"}
                                </button>
                                {reportPendingDelete?.id === report.id ? (
                                    <div className="report-delete-confirmation" role="group" aria-label={`Confirm deletion of ${report.dataset_name} report`}>
                                        <span>Delete this stored report?</span>
                                        <button type="button" onClick={() => setReportPendingDelete(null)} disabled={deletingReportId === report.id}>Cancel</button>
                                        <button type="button" onClick={deleteReport} disabled={deletingReportId === report.id}>
                                            {deletingReportId === report.id ? "Deleting…" : "Delete"}
                                        </button>
                                    </div>
                                ) : (
                                    <button type="button" onClick={() => setReportPendingDelete(report)}>Delete</button>
                                )}
                            </div>
                        </article>
                    ))}
                </section>
            ) : (
                <section className="reports-empty" aria-label="No generated reports">
                    <h2>No reports generated yet</h2>
                    <p>Select an analyzed dataset above to create a PDF or Excel report.</p>
                    {!datasets.length && <Link className="workspace-primary-button" to="/upload">Upload dataset</Link>}
                </section>
            )}
        </main>
    );
}

export default Reports;
