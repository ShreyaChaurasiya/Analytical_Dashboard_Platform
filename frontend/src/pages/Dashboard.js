import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { API_BASE_URL, apiRequest } from "../api/client";

function getQualityScore(dataset) {
    const cells = (dataset?.row_count || 0) * (dataset?.column_count || 0);
    if (!cells || !Number.isFinite(dataset?.missing_cells)) return null;
    return Math.round(((cells - dataset.missing_cells) / cells) * 100);
}

function Dashboard() {
    const location = useLocation();
    const preferredDatasetId = location.state?.datasetId;
    const [datasets, setDatasets] = useState([]);
    const [reports, setReports] = useState([]);
    const [dashboardExports, setDashboardExports] = useState([]);
    const [datasetFilter, setDatasetFilter] = useState("all");
    const [dataset, setDataset] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [qualityIssues, setQualityIssues] = useState([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisView, setAnalysisView] = useState("overview");
    const [timeRange, setTimeRange] = useState("all");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);
    const [analysisMessage, setAnalysisMessage] = useState("");
    const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(true);
    const [isDownloadOpen, setIsDownloadOpen] = useState(false);
    const [isExportingSummary, setIsExportingSummary] = useState(false);
    const [exportPendingDelete, setExportPendingDelete] = useState(null);
    const [downloadMessage, setDownloadMessage] = useState("");

    useEffect(() => {
        let isCurrent = true;

        async function loadDatasets() {
            setIsLoading(true);
            setError("");
            try {
                const token = window.localStorage.getItem("adp-access-token");
                const [result, reportRows, settings, exportRows] = await Promise.all([
                    apiRequest("/api/datasets", { token }),
                    apiRequest("/api/reports", { token }),
                    apiRequest("/api/settings", { token }),
                    apiRequest("/api/dashboard/exports", { token }),
                ]);
                if (!isCurrent) return;
                setDatasets(result);
                setReports(reportRows);
                setDashboardExports(exportRows);
                setAnalysisView(settings.dashboard_analysis_view);
                setTimeRange(settings.dashboard_time_range);

                const preferred = result.find((item) => item.id === Number(preferredDatasetId));
                setDatasetFilter((current) => {
                    if (preferred) return String(preferred.id);
                    if (current !== "all" && result.some((item) => String(item.id) === current)) {
                        return current;
                    }
                    const savedDataset = result.find(
                        (item) => item.id === settings.dashboard_default_dataset_id,
                    );
                    if (savedDataset) return String(savedDataset.id);
                    return "all";
                });
            } catch (loadError) {
                if (isCurrent) setError(loadError.message || "Dashboard data could not be loaded.");
            } finally {
                if (isCurrent) setIsLoading(false);
            }
        }

        loadDatasets();
        return () => {
            isCurrent = false;
        };
    }, [preferredDatasetId, refreshKey]);

    useEffect(() => {
        let isCurrent = true;

        async function loadSelectedDataset() {
            if (datasetFilter === "all") {
                setDataset(null);
                setAnalysis(null);
                setQualityIssues([]);
                return;
            }

            setDataset(null);
            setAnalysis(null);
            setQualityIssues([]);
            setAnalysisMessage("");
            try {
                const token = window.localStorage.getItem("adp-access-token");
                const [result, latestAnalysis] = await Promise.all([
                    apiRequest(
                        `/api/dashboard/datasets/${encodeURIComponent(datasetFilter)}/dashboard`,
                        { token },
                    ),
                    apiRequest(
                        `/api/analysis/datasets/${encodeURIComponent(datasetFilter)}/analysis`,
                        { token },
                    ),
                ]);
                if (!isCurrent) return;
                setDataset(result);
                setAnalysis(latestAnalysis);
                if (latestAnalysis) {
                    const issues = await apiRequest(
                        `/api/quality/datasets/${encodeURIComponent(datasetFilter)}/issues`,
                        { token },
                    );
                    if (isCurrent) setQualityIssues(issues);
                }
            } catch (loadError) {
                if (isCurrent) setError(loadError.message || "The selected dataset could not be loaded.");
            }
        }

        loadSelectedDataset();
        return () => {
            isCurrent = false;
        };
    }, [datasetFilter, refreshKey]);

    const visibleDatasets = useMemo(() => {
        if (timeRange === "all") return datasets;
        const days = Number(timeRange);
        const since = Date.now() - days * 24 * 60 * 60 * 1000;
        return datasets.filter((item) => new Date(item.created_at).getTime() >= since);
    }, [datasets, timeRange]);

    useEffect(() => {
        if (datasetFilter !== "all" && !visibleDatasets.some((item) => String(item.id) === datasetFilter)) {
            setDatasetFilter("all");
        }
    }, [datasetFilter, visibleDatasets]);

    const qualityScore = useMemo(() => {
        if (datasetFilter !== "all") return getQualityScore(dataset);
        const scores = visibleDatasets.map(getQualityScore).filter(Number.isFinite);
        return scores.length
            ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length)
            : null;
    }, [dataset, datasetFilter, visibleDatasets]);

    const metrics = [
        {
            label: "Total datasets",
            value: String(visibleDatasets.length),
            note: visibleDatasets.length ? "In your account" : "Upload your first dataset",
            tone: "green",
        },
        {
            label: "Data quality score",
            value: qualityScore === null ? "—" : `${qualityScore}%`,
            note: qualityScore === null ? "Available after upload" : "Based on available dataset summaries",
            tone: "blue",
        },
        {
            label: "Reports generated",
            value: String(reports.length),
            note: reports.length ? "Ready to download" : "Available after analysis",
            tone: "violet",
        },
        {
            label: "Pending reviews",
            value: datasetFilter === "all" ? "—" : String(qualityIssues.length),
            note: datasetFilter === "all"
                ? "Select a dataset to review findings"
                : analysis
                    ? (qualityIssues.length ? "Review detected data issues" : "Nothing needs attention")
                    : "Run analysis to check for issues",
            tone: "amber",
        },
    ];

    const downloadDashboardExport = async (savedExport) => {
        setDownloadMessage("");
        const response = await fetch(
            `${API_BASE_URL}/api/dashboard/exports/${encodeURIComponent(savedExport.id)}/download`,
            {
                headers: {
                    Authorization: `Bearer ${window.localStorage.getItem("adp-access-token")}`,
                },
            },
        );
        if (!response.ok) {
            const result = await response.json().catch(() => ({}));
            throw new Error(result.detail || "The dashboard download could not be retrieved.");
        }
        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement("a");
        link.href = url;
        link.download = savedExport.file_name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const createDashboardExport = async () => {
        setIsExportingSummary(true);
        setDownloadMessage("");
        try {
            const savedExport = await apiRequest("/api/dashboard/exports/summary", {
                method: "POST",
                token: window.localStorage.getItem("adp-access-token"),
                body: JSON.stringify({
                    dataset_id: datasetFilter === "all" ? null : Number(datasetFilter),
                    time_range: timeRange,
                }),
            });
            setDashboardExports((current) => [savedExport, ...current]);
            await downloadDashboardExport(savedExport);
            setDownloadMessage("A copy was downloaded to your device and saved in Dashboard downloads.");
        } catch (exportError) {
            setDownloadMessage(exportError.message || "The dashboard summary could not be downloaded.");
        } finally {
            setIsExportingSummary(false);
        }
    };

    const deleteDashboardExport = async () => {
        if (!exportPendingDelete) return;
        const exportId = exportPendingDelete.id;
        try {
            await apiRequest(`/api/dashboard/exports/${encodeURIComponent(exportId)}`, {
                method: "DELETE",
                token: window.localStorage.getItem("adp-access-token"),
            });
            setDashboardExports((current) => current.filter((item) => item.id !== exportId));
            setExportPendingDelete(null);
            setDownloadMessage("The saved dashboard copy was deleted. A copy already downloaded to your device remains there.");
        } catch (deleteError) {
            setDownloadMessage(deleteError.message || "The dashboard download could not be deleted.");
        }
    };

    const retrieveDashboardExport = async (savedExport) => {
        try {
            await downloadDashboardExport(savedExport);
            setDownloadMessage("A copy was downloaded to your device. The saved server copy is unchanged.");
        } catch (downloadError) {
            setDownloadMessage(downloadError.message || "The dashboard download could not be retrieved.");
        }
    };

    const runAnalysis = async () => {
        if (datasetFilter === "all") {
            setAnalysisMessage("Select a dataset from the Dataset filter before running analysis.");
            return;
        }

        setIsAnalyzing(true);
        setError("");
        setAnalysisMessage("");
        try {
            const token = window.localStorage.getItem("adp-access-token");
            const result = await apiRequest(
                `/api/analysis/datasets/${encodeURIComponent(datasetFilter)}/analysis`,
                { method: "POST", token },
            );
            const issues = await apiRequest(
                `/api/quality/datasets/${encodeURIComponent(datasetFilter)}/issues`,
                { token },
            );
            setAnalysis(result);
            setQualityIssues(issues);
        } catch (analysisError) {
            setError(analysisError.message || "The dataset could not be analyzed.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <main className={`workspace-page workspace-page-empty${isWorkspaceOpen ? "" : " workspace-page-collapsed"}`}>
            <aside className="workspace-sidebar" aria-label="Dashboard sections">
                <div className="workspace-sidebar-header"><button className="workspace-hide-control" type="button" aria-label="Hide workspace" aria-expanded={isWorkspaceOpen} onClick={() => setIsWorkspaceOpen(false)}>☰</button></div>
                <Link className="workspace-nav-link" to="/">Home</Link>
                <Link className="workspace-nav-link active" to="/dashboard" aria-current="page">Dashboard</Link>
                <Link className="workspace-nav-link" to="/upload">Upload data</Link>
                <Link className="workspace-nav-link" to="/reports">Reports</Link>
                <Link className="workspace-nav-link" to="/datasets">Data catalogue</Link>
                <Link className="workspace-nav-link" to="/quality">Quality checks</Link>
                <div className="workspace-download-menu">
                    <button className="workspace-nav-link" type="button" aria-expanded={isDownloadOpen} onClick={() => setIsDownloadOpen((open) => !open)}>Downloads</button>
                    {isDownloadOpen && <div className="workspace-download-dropdown">
                        <button type="button" onClick={createDashboardExport} disabled={isExportingSummary}>
                            {isExportingSummary ? "Saving summary…" : "Download summary CSV"}
                        </button>
                        {dashboardExports.length > 0 && (
                            <div className="workspace-saved-exports">
                                <span>Saved on this website</span>
                                {dashboardExports.map((savedExport) => (
                                    <div key={savedExport.id} className="workspace-saved-export">
                                        <button type="button" onClick={() => retrieveDashboardExport(savedExport)}>
                                            {savedExport.file_name}
                                        </button>
                                        {exportPendingDelete?.id === savedExport.id ? (
                                            <span className="workspace-export-delete-confirmation">
                                                <span>Delete server copy?</span>
                                                <button type="button" onClick={() => setExportPendingDelete(null)}>Cancel</button>
                                                <button type="button" onClick={deleteDashboardExport}>Confirm</button>
                                            </span>
                                        ) : (
                                            <button type="button" onClick={() => setExportPendingDelete(savedExport)}>Delete</button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        <Link to="/reports" role="menuitem" onClick={() => setIsDownloadOpen(false)}>View and download reports</Link>
                        {downloadMessage && <span className="workspace-download-status" role="status">{downloadMessage}</span>}
                    </div>}
                </div>
                <div className="workspace-sidebar-divider" />
                <Link className="workspace-nav-link" to="/help">Help centre</Link>
                <Link className="workspace-nav-link" to="/dashboard/settings">Settings</Link>
                <div className="workspace-sidebar-footer"><span className="workspace-nav-label"><strong>Ready for your data</strong><small>Upload a file to begin</small></span></div>
            </aside>
            {!isWorkspaceOpen && <button className="workspace-show-control" type="button" aria-label="Show workspace" onClick={() => setIsWorkspaceOpen(true)}>☰</button>}

            <section className="workspace-main">
                <div className="workspace-topbar">
                    <div><p className="dashboard-eyebrow">ANALYTICAL DASHBOARD</p><h1>Start with your data</h1><p className="workspace-subtitle">Upload any CSV or spreadsheet and we will prepare an analysis-ready dashboard and report.</p></div>
                    <div className="workspace-actions"><button className="workspace-analysis-button" type="button" onClick={runAnalysis} disabled={isAnalyzing}>{isAnalyzing ? "Analyzing…" : "Run analysis"}</button><Link className="workspace-primary-button" to="/upload">Upload dataset</Link></div>
                </div>

                <div className="workspace-filterbar workspace-filterbar-expanded dashboard-filterbar" aria-label="Dashboard filters">
                    <label id="dataset-filter">Dataset<select aria-label="Dataset" value={datasetFilter} onChange={(event) => setDatasetFilter(event.target.value)} disabled={isLoading}>
                        <option value="all">All uploaded datasets</option>
                        {visibleDatasets.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
                    </select></label>
                    <label>Analysis view<select aria-label="Analysis view" value={analysisView} onChange={(event) => setAnalysisView(event.target.value)}>
                        <option value="overview">Overview</option>
                        <option value="activity">Data activity</option>
                        <option value="summary">Data summary</option>
                    </select></label>
                    <label>Time range<select aria-label="Time range" value={timeRange} onChange={(event) => setTimeRange(event.target.value)}>
                        <option value="all">All available data</option>
                        <option value="7">Last 7 days</option>
                        <option value="30">Last 30 days</option>
                    </select></label>
                    <span className="workspace-updated">{error ? "Dashboard data unavailable" : isLoading ? "Loading datasets…" : dataset ? dataset.name : "No dataset selected"}</span>
                </div>

                {error && <section className="analysis-progress-card" role="alert"><div className="analysis-progress-copy"><div><strong>Dashboard data could not be loaded</strong><p>{error}</p></div></div><button className="panel-link" type="button" onClick={() => setRefreshKey((key) => key + 1)}>Try again</button></section>}
                {analysisMessage && <section className="analysis-progress-card" role="status"><div className="analysis-progress-copy"><div><strong>Analysis not started</strong><p>{analysisMessage}</p></div></div></section>}
                <section className="metric-grid" aria-label="Workspace summary">{metrics.map((metric) => <article className={`metric-card metric-${metric.tone}`} key={metric.label}><div className="metric-card-head" /><p>{metric.label}</p><strong>{metric.value}</strong><small>{metric.note}</small></article>)}</section>

                <div className="workspace-content-grid">
                    {(analysisView === "overview" || analysisView === "activity") && <article className={`dashboard-panel panel-trend empty-panel${analysisView === "activity" ? " workspace-panel-full" : ""}`} id="data-activity"><div className="panel-heading"><div><h2>Data activity</h2><p>{analysis ? `Analysis completed ${new Date(analysis.created_at).toLocaleString()}.` : "Your activity trend will appear here."}</p></div></div><div className="empty-panel-body"><strong>{analysis ? `${analysis.results.row_count.toLocaleString()} rows analyzed` : visibleDatasets.length ? (dataset?.name || visibleDatasets[0].name) : "Upload a dataset to see activity"}</strong><p>{analysis ? `${analysis.results.column_count} columns · ${analysis.results.missing_cells} missing values · ${analysis.results.duplicate_rows} duplicate rows` : visibleDatasets.length ? `${dataset ? "Selected dataset" : "Most recently uploaded dataset"} · ${new Date(dataset?.created_at || visibleDatasets[0].created_at).toLocaleString()}` : "Charts and trends will be generated after your first analysis."}</p>{!visibleDatasets.length && <Link to="/upload" className="panel-link">Upload dataset</Link>}</div></article>}
                    {(analysisView === "overview" || analysisView === "summary") && <article className={`dashboard-panel panel-sources empty-panel${analysisView === "summary" ? " workspace-panel-full" : ""}`} id="quality-checks"><div className="panel-heading"><div><h2>Data summary</h2><p>Source and quality insights will appear here.</p></div></div><div className="empty-panel-body"><strong>{dataset ? dataset.name : "No data available yet"}</strong><p>{analysis ? analysis.results.columns.map((column) => `${column.name}: ${column.inferred_type} · ${column.missing_count} missing`).join(" | ") : dataset ? `${dataset.file_type?.toUpperCase() || "Dataset"}${dataset.headers?.length ? ` · ${dataset.headers.join(" · ")}` : ""}` : "We will identify columns, values, and quality issues automatically."}</p>{analysis && qualityIssues.length > 0 && <p>{qualityIssues.length} quality findings detected.</p>}</div></article>}
                    {analysisView === "overview" && <article className="dashboard-panel panel-activity empty-panel"><div className="panel-heading"><div><h2>Recent activity</h2><p>Your generated dashboards and reports will appear here.</p></div><Link to="/reports" className="panel-link">View reports</Link></div><div className="empty-panel-body"><strong>{reports.length ? `${reports.length} report${reports.length === 1 ? "" : "s"} available` : "No reports generated"}</strong><p>{reports.length ? `Latest report for ${reports[0].dataset_name} · ${new Date(reports[0].created_at).toLocaleString()}` : "Run analysis after uploading a dataset to create your first report."}</p></div></article>}
                </div>
            </section>
        </main>
    );
}

export default Dashboard;
