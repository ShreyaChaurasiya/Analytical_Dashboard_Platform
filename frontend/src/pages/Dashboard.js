import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiRequest } from "../api/client";

function getQualityScore(dataset) {
    const cells = (dataset?.row_count || 0) * (dataset?.column_count || 0);
    if (!cells || !Number.isFinite(dataset?.missing_cells)) return null;
    return Math.round(((cells - dataset.missing_cells) / cells) * 100);
}

function Dashboard() {
    const location = useLocation();
    const preferredDatasetId = location.state?.datasetId;
    const [datasets, setDatasets] = useState([]);
    const [datasetFilter, setDatasetFilter] = useState("all");
    const [dataset, setDataset] = useState(null);
    const [analysisView, setAnalysisView] = useState("overview");
    const [timeRange, setTimeRange] = useState("all");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);
    const [analysisMessage, setAnalysisMessage] = useState("");
    const [notice, setNotice] = useState("");
    const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(true);
    const [isDownloadOpen, setIsDownloadOpen] = useState(false);

    useEffect(() => {
        let isCurrent = true;

        async function loadDatasets() {
            setIsLoading(true);
            setError("");
            try {
                const result = await apiRequest("/api/datasets", {
                    token: window.localStorage.getItem("adp-access-token"),
                });
                if (!isCurrent) return;
                setDatasets(result);

                const preferred = result.find((item) => item.id === Number(preferredDatasetId));
                setDatasetFilter((current) => {
                    if (preferred) return String(preferred.id);
                    if (current !== "all" && result.some((item) => String(item.id) === current)) {
                        return current;
                    }
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
                return;
            }

            setDataset(null);
            setAnalysisMessage("");
            try {
                const result = await apiRequest(
                    `/api/dashboard/datasets/${encodeURIComponent(datasetFilter)}/dashboard`,
                    { token: window.localStorage.getItem("adp-access-token") },
                );
                if (isCurrent) setDataset(result);
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
            value: "0",
            note: "Available after analysis",
            tone: "violet",
        },
        {
            label: "Pending reviews",
            value: "0",
            note: "Nothing needs attention",
            tone: "amber",
        },
    ];

    const summaryCsv = [
        "item,value",
        `Dataset,${JSON.stringify(dataset?.name || "All uploaded datasets")}`,
        `Data quality score,${qualityScore === null ? "Not available" : `${qualityScore}%`}`,
        `Reports generated,0`,
        `Pending reviews,0`,
        `Column names,${JSON.stringify((dataset?.headers || []).join(" | "))}`,
    ].join("\n");

    const runAnalysis = () => {
        setAnalysisMessage("Analysis is not available yet.");
    };

    return (
        <main className={`workspace-page workspace-page-empty${isWorkspaceOpen ? "" : " workspace-page-collapsed"}`}>
            <aside className="workspace-sidebar" aria-label="Dashboard sections">
                <div className="workspace-sidebar-header"><button className="workspace-hide-control" type="button" aria-label="Hide workspace" aria-expanded={isWorkspaceOpen} onClick={() => setIsWorkspaceOpen(false)}>☰</button></div>
                <Link className="workspace-nav-link" to="/">Home</Link>
                <Link className="workspace-nav-link active" to="/dashboard" aria-current="page">Overview</Link>
                <Link className="workspace-nav-link" to="/upload">Upload data</Link>
                <Link className="workspace-nav-link" to="/reports">Reports</Link>
                <Link className="workspace-nav-link" to="/dashboard#dataset-filter">Data catalogue</Link>
                <Link className="workspace-nav-link" to="/dashboard#quality-checks">Quality checks</Link>
                <div className="workspace-download-menu">
                    <button className="workspace-nav-link" type="button" aria-expanded={isDownloadOpen} onClick={() => setIsDownloadOpen((open) => !open)}>Downloads</button>
                    {isDownloadOpen && <div className="workspace-download-dropdown">
                        <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(summaryCsv)}`} download="adp-dashboard-summary.csv" onClick={() => setIsDownloadOpen(false)}>Download summary CSV</a>
                        <a href={`data:text/plain;charset=utf-8,${encodeURIComponent("No report has been generated yet.")}`} download="adp-report-status.txt" onClick={() => setIsDownloadOpen(false)}>Download report status</a>
                    </div>}
                </div>
                <div className="workspace-sidebar-divider" />
                <button className="workspace-nav-link" type="button" onClick={() => setNotice("Settings are not available yet.")}>Settings</button>
                <Link className="workspace-nav-link" to="/help">Help centre</Link>
                <div className="workspace-sidebar-footer"><span className="workspace-nav-label"><strong>Ready for your data</strong><small>Upload a file to begin</small></span></div>
            </aside>
            {!isWorkspaceOpen && <button className="workspace-show-control" type="button" aria-label="Show workspace" onClick={() => setIsWorkspaceOpen(true)}>☰</button>}

            <section className="workspace-main">
                <div className="workspace-topbar">
                    <div><p className="dashboard-eyebrow">ANALYTICAL DASHBOARD</p><h1>Start with your data</h1><p className="workspace-subtitle">Upload any CSV or spreadsheet and we will prepare an analysis-ready dashboard and report.</p></div>
                    <div className="workspace-actions"><button className="workspace-analysis-button" type="button" onClick={runAnalysis}>Run analysis</button><Link className="workspace-primary-button" to="/upload">Upload dataset</Link></div>
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
                {notice && <section className="analysis-progress-card" role="status"><div className="analysis-progress-copy"><div><strong>Not available yet</strong><p>{notice}</p></div></div></section>}

                <section className="metric-grid" aria-label="Workspace summary">{metrics.map((metric) => <article className={`metric-card metric-${metric.tone}`} key={metric.label}><div className="metric-card-head" /><p>{metric.label}</p><strong>{metric.value}</strong><small>{metric.note}</small></article>)}</section>

                <div className="workspace-content-grid">
                    {(analysisView === "overview" || analysisView === "activity") && <article className={`dashboard-panel panel-trend empty-panel${analysisView === "activity" ? " workspace-panel-full" : ""}`} id="data-activity"><div className="panel-heading"><div><h2>Data activity</h2><p>Your activity trend will appear here.</p></div></div><div className="empty-panel-body"><strong>{visibleDatasets.length ? (dataset?.name || visibleDatasets[0].name) : "Upload a dataset to see activity"}</strong><p>{visibleDatasets.length ? `${dataset ? "Selected dataset" : "Most recently uploaded dataset"} · ${new Date(dataset?.created_at || visibleDatasets[0].created_at).toLocaleString()}` : "Charts and trends will be generated after your first analysis."}</p>{!visibleDatasets.length && <Link to="/upload" className="panel-link">Upload dataset</Link>}</div></article>}
                    {(analysisView === "overview" || analysisView === "summary") && <article className={`dashboard-panel panel-sources empty-panel${analysisView === "summary" ? " workspace-panel-full" : ""}`} id="quality-checks"><div className="panel-heading"><div><h2>Data summary</h2><p>Source and quality insights will appear here.</p></div></div><div className="empty-panel-body"><strong>{dataset ? dataset.name : "No data available yet"}</strong><p>{dataset ? `${dataset.file_type?.toUpperCase() || "Dataset"}${dataset.headers?.length ? ` · ${dataset.headers.join(" · ")}` : ""}` : "We will identify columns, values, and quality issues automatically."}</p></div></article>}
                    {analysisView === "overview" && <article className="dashboard-panel panel-activity empty-panel"><div className="panel-heading"><div><h2>Recent activity</h2><p>Your generated dashboards and reports will appear here.</p></div><Link to="/reports" className="panel-link">View reports</Link></div><div className="empty-panel-body"><strong>No reports generated</strong><p>Run analysis after uploading a dataset to create your first report.</p></div></article>}
                </div>
            </section>
        </main>
    );
}

export default Dashboard;
