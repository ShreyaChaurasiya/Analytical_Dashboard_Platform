import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { API_BASE_URL, apiRequest } from "../api/client";

const DASHBOARD_WIDGETS = [
    { id: "value-distribution", label: "Category breakdown" },
    { id: "numeric-profile", label: "Numeric profile" },
    { id: "missing-values", label: "Missing values" },
    { id: "column-overview", label: "Column overview" },
    { id: "insights", label: "Dataset insights" },
    { id: "correlations", label: "Numeric relationships" },
];

function defaultLayout(title = "Dataset dashboard") {
    return {
        title,
        visible_widgets: DASHBOARD_WIDGETS.map((widget) => widget.id),
        category_column: null,
        numeric_column: null,
        distribution_chart: "bar",
    };
}

function getQualityScore(dataset) {
    const cells = (dataset?.row_count || 0) * (dataset?.column_count || 0);
    if (!cells || !Number.isFinite(dataset?.missing_cells)) return null;
    return Math.round(((cells - dataset.missing_cells) / cells) * 100);
}

function formatValue(value) {
    return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

const CHART_COLORS = ["#2878b5", "#32a27a", "#e39b3d", "#8d6ac8", "#d56f68", "#4a9da7"];

function DistributionChart({ column, chartType }) {
    const values = column?.top_values || [];
    const maximum = Math.max(1, ...values.map((item) => item.count));

    if (chartType === "pie" || chartType === "donut") {
        const total = values.reduce((sum, item) => sum + item.count, 0);
        const radius = 62;
        const circumference = 2 * Math.PI * radius;
        let offset = 0;
        return total ? (
            <div className="dataset-pie-layout">
                <svg className={`dataset-pie-chart${chartType === "donut" ? " dataset-donut-chart" : ""}`} viewBox="0 0 160 160" role="img" aria-label={`${chartType === "pie" ? "Pie chart" : "Donut chart"} showing category shares for ${column.name}`}>
                    {values.map((item, index) => {
                        const length = item.count / total * circumference;
                        const circle = (
                            <circle
                                key={item.value}
                                cx="80"
                                cy="80"
                                r={radius}
                                fill="none"
                                stroke={CHART_COLORS[index % CHART_COLORS.length]}
                                strokeWidth={chartType === "donut" ? 27 : 124}
                                strokeDasharray={`${length} ${circumference - length}`}
                                strokeDashoffset={-offset}
                                transform="rotate(-90 80 80)"
                            />
                        );
                        offset += length;
                        return circle;
                    })}
                    {chartType === "donut" && <text x="80" y="77" textAnchor="middle" className="dataset-donut-total">{formatValue(total)}</text>}
                    {chartType === "donut" && <text x="80" y="94" textAnchor="middle" className="dataset-donut-caption">records</text>}
                </svg>
                <ul className="dataset-chart-legend">
                    {values.map((item, index) => (
                        <li key={item.value}>
                            <span style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                            <span title={item.value}>{item.value || "(blank)"}</span>
                            <strong>{formatValue(item.count)} · {((item.count / total) * 100).toFixed(1)}%</strong>
                        </li>
                    ))}
                </ul>
            </div>
        ) : <p className="dataset-chart-empty">No category counts are available to compare.</p>;
    }

    return values.length ? (
        <div className={`dataset-chart-bars${chartType === "column" ? " dataset-chart-bars-vertical" : ""}`} role="img" aria-label={`${chartType === "column" ? "Column chart" : "Bar chart"} showing the most common values in ${column.name}`}>
            {values.map((item) => (
                <div className="dataset-chart-row" key={item.value}>
                    <span className="dataset-chart-label" title={item.value}>{item.value || "(blank)"}</span>
                    <span className="dataset-chart-track">
                        <span className="dataset-chart-bar" style={chartType === "column"
                            ? { height: `${(item.count / maximum) * 100}%` }
                            : { width: `${(item.count / maximum) * 100}%` }} />
                    </span>
                    <strong>{formatValue(item.count)}</strong>
                </div>
            ))}
        </div>
    ) : <p className="dataset-chart-empty">No category values are available for this column.</p>;
}

function HistogramChart({ column }) {
    const bins = column?.histogram || [];
    const maximum = Math.max(1, ...bins.map((bin) => bin.count));
    return bins.length ? (
        <div className="dataset-histogram" role="img" aria-label={`Histogram showing the frequency distribution of ${column.name}`}>
            <div className="dataset-histogram-bars">
                {bins.map((bin, index) => (
                    <div className="dataset-histogram-bin" key={`${bin.start}-${index}`}>
                        <span className="dataset-histogram-count">{formatValue(bin.count)}</span>
                        <span className="dataset-histogram-track">
                            <span style={{ height: `${(bin.count / maximum) * 100}%` }} />
                        </span>
                        <span className="dataset-histogram-label">{formatValue(bin.start)}</span>
                    </div>
                ))}
            </div>
            <div className="dataset-histogram-axis"><span>{formatValue(bins[0].start)}</span><span>{formatValue(bins[bins.length - 1].end)}</span></div>
            <p className="dataset-chart-caption">Each bar counts records in a numeric range. Taller bars show ranges that occur more often.</p>
        </div>
    ) : <p className="dataset-chart-empty">No numeric distribution is available for this column.</p>;
}

function CorrelationHeatmap({ correlations }) {
    const names = Object.keys(correlations || {});
    if (names.length < 2) {
        return <p className="dataset-chart-empty">Add at least two numeric columns to compare how they move together.</p>;
    }
    return (
        <>
            <p className="dataset-chart-caption">Correlation ranges from −1 (move in opposite directions) to +1 (move together). Values near 0 indicate a weak linear relationship; correlation does not prove cause.</p>
            <div className="dataset-heatmap-wrap">
                <table className="dataset-heatmap">
                    <thead><tr><th scope="col">Column</th>{names.map((name) => <th scope="col" key={name}>{name}</th>)}</tr></thead>
                    <tbody>{names.map((rowName) => (
                        <tr key={rowName}>
                            <th scope="row">{rowName}</th>
                            {names.map((columnName) => {
                                const value = correlations[rowName]?.[columnName];
                                const magnitude = Number.isFinite(value) ? Math.abs(value) : 0;
                                const tint = value >= 0 ? `rgba(44, 148, 112, ${magnitude * 0.25})` : `rgba(65, 123, 190, ${magnitude * 0.25})`;
                                return <td key={columnName} style={{ backgroundColor: tint }}>{Number.isFinite(value) ? value.toFixed(2) : "—"}</td>;
                            })}
                        </tr>
                    ))}</tbody>
                </table>
            </div>
        </>
    );
}

function NumericProfileChart({ column }) {
    const statistics = column?.statistics || {};
    const values = [
        ["Minimum", statistics.minimum],
        ["Mean", statistics.mean],
        ["Median", statistics.median],
        ["Maximum", statistics.maximum],
    ].filter(([, value]) => Number.isFinite(value));
    const minimum = Math.min(0, ...values.map(([, value]) => value));
    const maximum = Math.max(0, ...values.map(([, value]) => value));
    const range = maximum - minimum || 1;
    const zeroPosition = (0 - minimum) / range * 100;

    return values.length ? (
        <div className="dataset-chart-bars dataset-numeric-chart" role="img" aria-label={`Numeric summary statistics for ${column.name}`}>
            {values.map(([label, value]) => {
                const valuePosition = (value - minimum) / range * 100;
                const left = Math.min(zeroPosition, valuePosition);
                const width = Math.max(Math.abs(valuePosition - zeroPosition), 1);
                return (
                    <div className="dataset-chart-row" key={label}>
                        <span className="dataset-chart-label">{label}</span>
                        <span className="dataset-chart-track" style={{ background: `linear-gradient(90deg, #f8eeee 0 ${zeroPosition}%, #edf7f1 ${zeroPosition}% 100%)` }}>
                            <span className="dataset-chart-zero" style={{ left: `${zeroPosition}%` }} />
                            <span className="dataset-chart-bar" style={{ left: `${left}%`, width: `${width}%` }} />
                        </span>
                        <strong>{formatValue(value)}</strong>
                    </div>
                );
            })}
        </div>
    ) : <p className="dataset-chart-empty">No numeric statistics are available for this column.</p>;
}

function FolderDashboard({ datasetIds, location }) {
    const datasetKey = datasetIds.join(",");
    const [datasets, setDatasets] = useState([]);
    const [analyses, setAnalyses] = useState({});
    const [qualityIssues, setQualityIssues] = useState({});
    const [loadErrors, setLoadErrors] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState("");
    const [chartType, setChartType] = useState("bar");
    const [error, setError] = useState("");

    useEffect(() => {
        let isCurrent = true;

        async function loadFolderDashboard() {
            setIsLoading(true);
            try {
                const token = window.localStorage.getItem("adp-access-token");
                const allDatasets = await apiRequest("/api/datasets", { token });
                const ids = datasetKey.split(",").filter(Boolean);
                const selectedDatasets = ids
                    .map((id) => allDatasets.find((item) => String(item.id) === String(id)))
                    .filter(Boolean);
                if (!isCurrent) return;
                setDatasets(selectedDatasets);
                if (selectedDatasets.length !== ids.length) {
                    setError("Some uploaded datasets could not be found in your account.");
                }

                const results = await Promise.all(selectedDatasets.map(async (item) => {
                    try {
                        const analysis = await apiRequest(
                            `/api/analysis/datasets/${encodeURIComponent(item.id)}/analysis`,
                            { token },
                        );
                        const issues = analysis
                            ? await apiRequest(
                                `/api/quality/datasets/${encodeURIComponent(item.id)}/issues`,
                                { token },
                            )
                            : [];
                        return { id: item.id, analysis, issues, error: "" };
                    } catch (loadError) {
                        return {
                            id: item.id,
                            analysis: null,
                            issues: [],
                            error: loadError.message || "This dataset could not be loaded.",
                        };
                    }
                }));
                if (!isCurrent) return;
                setAnalyses(Object.fromEntries(results.filter((item) => item.analysis).map((item) => [item.id, item.analysis])));
                setQualityIssues(Object.fromEntries(results.map((item) => [item.id, item.issues])));
                setLoadErrors(Object.fromEntries(results.filter((item) => item.error).map((item) => [item.id, item.error])));
            } catch (loadError) {
                if (isCurrent) setError(loadError.message || "The folder dashboard could not be loaded.");
            } finally {
                if (isCurrent) setIsLoading(false);
            }
        }

        loadFolderDashboard();
        return () => {
            isCurrent = false;
        };
    }, [datasetKey]);

    const generateAllDashboards = async () => {
        if (isGenerating) return;
        setIsGenerating(true);
        setError("");
        setLoadErrors({});
        const token = window.localStorage.getItem("adp-access-token");
        let completed = 0;
        const failures = {};

        for (const [index, item] of datasets.entries()) {
            setProgress(`Analyzing ${item.name} (${index + 1} of ${datasets.length})…`);
            try {
                const analysis = await apiRequest(
                    `/api/analysis/datasets/${encodeURIComponent(item.id)}/analysis`,
                    { method: "POST", token },
                );
                const issues = await apiRequest(
                    `/api/quality/datasets/${encodeURIComponent(item.id)}/issues`,
                    { token },
                );
                setAnalyses((current) => ({ ...current, [item.id]: analysis }));
                setQualityIssues((current) => ({ ...current, [item.id]: issues }));
                completed += 1;
            } catch (analysisError) {
                failures[item.id] = analysisError.message || "Analysis failed.";
                if (analysisError.status === 401) break;
            }
        }

        setLoadErrors(failures);
        setProgress(
            completed === datasets.length
                ? `Dashboard generated for all ${completed} files.`
                : `Dashboard generated for ${completed} of ${datasets.length} files. Review the file-level errors below.`,
        );
        setIsGenerating(false);
    };

    const analyzedDatasets = datasets.filter((item) => analyses[item.id]);
    const totalRows = analyzedDatasets.reduce(
        (total, item) => total + analyses[item.id].results.row_count,
        0,
    );
    const totalFindings = analyzedDatasets.reduce(
        (total, item) => total + (qualityIssues[item.id]?.length || 0),
        0,
    );
    const needsGeneration = datasets.some((item) => !analyses[item.id]);

    return (
        <main className="workspace-page workspace-page-no-sidebar">
            <aside className="workspace-sidebar" aria-label="Dashboard sections">
                <Link className="workspace-nav-link" to="/">Home</Link>
                <Link className="workspace-nav-link active" to="/dashboard" aria-current="page">Dashboard</Link>
                <Link className="workspace-nav-link" to="/upload">Upload data</Link>
                <Link className="workspace-nav-link" to="/reports">Reports</Link>
                <Link className="workspace-nav-link" to="/datasets">Data catalogue</Link>
                <Link className="workspace-nav-link" to="/quality">Quality checks</Link>
                <Link className="workspace-nav-link" to="/settings">Settings</Link>
            </aside>
            <section className="workspace-main folder-dashboard-main">
                <div className="workspace-topbar">
                    <div>
                        <p className="dashboard-eyebrow">FOLDER WORKSPACE / MULTI-DATASET DASHBOARD</p>
                        <h1>Folder dashboard</h1>
                        <p className="workspace-subtitle">{datasets.length} uploaded files · each file is prepared and analyzed in its own section.</p>
                    </div>
                    <div className="workspace-actions">
                        <Link className="workspace-analysis-button" to="/upload">Upload another folder</Link>
                        {analyzedDatasets.length > 0 && <button className="workspace-analysis-button" type="button" onClick={() => window.print()}>Print / save dashboard</button>}
                        <button className="workspace-primary-button" type="button" onClick={generateAllDashboards} disabled={isLoading || isGenerating || !datasets.length}>
                            {isLoading ? "Loading files…" : isGenerating ? "Processing folder…" : needsGeneration ? `Generate dashboard for all ${datasets.length} files` : "Regenerate all dashboards"}
                        </button>
                    </div>
                </div>

                {location.state?.uploadSummary && <section className="analysis-progress-card" role="status">
                    <div className="analysis-progress-copy"><div><strong>Folder upload complete</strong><p>{location.state.uploadSummary}</p>
                        {location.state.uploadFailures?.map((failure, index) => <p key={`${failure}-${index}`}>{failure}</p>)}
                    </div></div>
                </section>}
                {error && <p className="upload-message upload-error" role="alert">{error}</p>}
                {isLoading && <p className="dashboard-layout-status" role="status">Loading folder datasets…</p>}
                {progress && <p className="dashboard-layout-status" role="status">{progress}</p>}

                <section className="folder-preparation-note" aria-label="Folder analysis and preparation">
                    <h2>How your folder is prepared</h2>
                    <ol>
                        <li><strong>Validate and read</strong><span>Each supported file is opened using its own data format.</span></li>
                        <li><strong>Profile and preprocess</strong><span>Column types, numeric ranges, distributions, and summary statistics are inferred.</span></li>
                        <li><strong>Check data quality</strong><span>Missing values, duplicate rows, and numeric outliers are identified for review.</span></li>
                        <li><strong>Build visualizations</strong><span>Charts are generated for each file without mixing unrelated tables or changing your originals.</span></li>
                    </ol>
                    <p>Cleaning is non-destructive: this dashboard highlights issues and recommendations; it does not delete rows or overwrite source files.</p>
                </section>

                {analyzedDatasets.length > 0 && <section className="metric-grid folder-dashboard-metrics" aria-label="Folder dashboard summary">
                    <article className="metric-card"><p>Files analyzed</p><strong>{analyzedDatasets.length} / {datasets.length}</strong><small>From this folder</small></article>
                    <article className="metric-card metric-blue"><p>Total records</p><strong>{formatValue(totalRows)}</strong><small>Across analyzed files</small></article>
                    <article className="metric-card metric-violet"><p>Quality findings</p><strong>{formatValue(totalFindings)}</strong><small>Review before using the data</small></article>
                    <article className="metric-card metric-amber"><p>Files needing analysis</p><strong>{datasets.length - analyzedDatasets.length}</strong><small>Use Generate dashboard to continue</small></article>
                </section>}

                <div className="folder-dashboard-toolbar">
                    <div><h2>Visualization style</h2><p>Choose how category shares appear across the folder dashboard.</p></div>
                    <label className="dataset-chart-select">Category chart
                        <select aria-label="Folder category chart style" value={chartType} onChange={(event) => setChartType(event.target.value)}>
                            <option value="bar">Bar</option>
                            <option value="column">Column</option>
                            <option value="pie">Pie</option>
                            <option value="donut">Donut</option>
                        </select>
                    </label>
                </div>

                <div className="folder-dashboard-list">
                    {datasets.map((item) => {
                        const analysis = analyses[item.id];
                        const results = analysis?.results;
                        const columns = results?.columns || [];
                        const categorical = columns.find((column) => ["categorical", "boolean"].includes(column.inferred_type) && column.top_values?.length);
                        const numeric = columns.find((column) => column.inferred_type === "numeric" && column.statistics);
                        const missing = columns.filter((column) => column.missing_count > 0).sort((a, b) => b.missing_count - a.missing_count).slice(0, 6);
                        const issues = qualityIssues[item.id] || [];

                        return (
                            <section className="folder-dataset-section" key={item.id} aria-labelledby={`folder-dataset-${item.id}`}>
                                <header className="folder-dataset-heading">
                                    <div><p className="dashboard-eyebrow">{item.file_type?.toUpperCase()} DATASET</p><h2 id={`folder-dataset-${item.id}`}>{item.name}</h2><p>{analysis ? `${formatValue(results.row_count)} records · ${results.column_count} fields` : `${(item.file_size / (1024 * 1024)).toFixed(1)} MB · waiting for dashboard generation`}</p></div>
                                    {analysis && <span className="dataset-chart-selected-column">{issues.length ? `${issues.length} quality findings` : "No quality findings"}</span>}
                                </header>

                                {loadErrors[item.id] && <p className="upload-message upload-error" role="alert">{item.name}: {loadErrors[item.id]}</p>}
                                {!analysis && !loadErrors[item.id] && <p className="dataset-chart-empty">This file is ready. Select “Generate dashboard for all files” to analyze it with the rest of the folder.</p>}

                                {analysis && <div className="workspace-content-grid dataset-dashboard-grid folder-file-charts">
                                    <article className="dashboard-panel dataset-chart-panel">
                                        <div className="panel-heading"><div><h3>Category breakdown</h3><p>Most frequent groups in this file</p></div>{categorical && <span className="dataset-chart-selected-column">{categorical.name}</span>}</div>
                                        {categorical ? <DistributionChart column={categorical} chartType={chartType} /> : <p className="dataset-chart-empty">No categorical fields were detected in this file.</p>}
                                    </article>
                                    <article className="dashboard-panel dataset-chart-panel">
                                        <div className="panel-heading"><div><h3>Numeric profile</h3><p>Range, average, and median</p></div>{numeric && <span className="dataset-chart-selected-column">{numeric.name}</span>}</div>
                                        {numeric ? <NumericProfileChart column={numeric} /> : <p className="dataset-chart-empty">No numeric fields were detected in this file.</p>}
                                    </article>
                                    <article className="dashboard-panel dataset-chart-panel">
                                        <div className="panel-heading"><div><h3>Value histogram</h3><p>Frequency across numeric ranges</p></div>{numeric && <span className="dataset-chart-selected-column">{numeric.name}</span>}</div>
                                        {numeric ? <HistogramChart column={numeric} /> : <p className="dataset-chart-empty">A histogram requires a numeric field.</p>}
                                    </article>
                                    <article className="dashboard-panel dataset-chart-panel">
                                        <div className="panel-heading"><div><h3>Data quality review</h3><p>Issues to review before relying on this file</p></div></div>
                                        <ul className="folder-quality-list">
                                            {missing.length
                                                ? missing.map((column) => <li key={column.name}><strong>{column.name}</strong>: {formatValue(column.missing_count)} missing values</li>)
                                                : <li>No missing values were detected.</li>}
                                            <li>{formatValue(results.duplicate_rows)} duplicate rows detected.</li>
                                            {issues.filter((issue) => issue.issue_type === "numeric_outliers").map((issue) => <li key={`${issue.issue_type}-${issue.column_name}`}><strong>{issue.column_name}</strong>: {issue.description}</li>)}
                                            {!issues.length && <li>No additional quality issues were detected.</li>}
                                        </ul>
                                    </article>
                                    <article className="dashboard-panel dataset-insight-panel">
                                        <div className="panel-heading"><div><h3>File insights</h3><p>Summary of this dataset</p></div></div>
                                        <ul>
                                            {categorical?.top_values?.[0] && <li><strong>{categorical.top_values[0].value}</strong> is the most frequent value in <strong>{categorical.name}</strong> ({formatValue(categorical.top_values[0].count)} records).</li>}
                                            {numeric?.statistics && <li><strong>{numeric.name}</strong> ranges from {formatValue(numeric.statistics.minimum)} to {formatValue(numeric.statistics.maximum)} with an average of {formatValue(numeric.statistics.mean)}.</li>}
                                            <li>{formatValue(results.missing_cells)} missing cells and {formatValue(results.duplicate_rows)} duplicate rows were found across {formatValue(results.row_count)} records.</li>
                                        </ul>
                                    </article>
                                    {Object.keys(results.correlations || {}).length > 1 && <article className="dashboard-panel dataset-chart-panel dataset-correlation-panel">
                                        <div className="panel-heading"><div><h3>Numeric relationships</h3><p>Compare numeric fields; correlation does not prove cause.</p></div></div>
                                        <CorrelationHeatmap correlations={results.correlations} />
                                    </article>}
                                </div>}
                            </section>
                        );
                    })}
                    {!isLoading && !datasets.length && <p className="dataset-chart-empty">No files from this folder are available. Upload the folder again to start a dashboard.</p>}
                </div>
            </section>
        </main>
    );
}

function SingleDatasetDashboard() {
    const location = useLocation();
    const preferredDatasetId = location.state?.datasetId
        || new URLSearchParams(location.search).get("datasets")?.split(",")[0];
    const [datasets, setDatasets] = useState([]);
    const [reports, setReports] = useState([]);
    const [dashboardExports, setDashboardExports] = useState([]);
    const [datasetFilter, setDatasetFilter] = useState("all");
    const [dataset, setDataset] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [qualityIssues, setQualityIssues] = useState([]);
    const [dashboardLayout, setDashboardLayout] = useState(null);
    const [layoutDraft, setLayoutDraft] = useState(null);
    const [isEditingDashboard, setIsEditingDashboard] = useState(false);
    const [isSavingDashboard, setIsSavingDashboard] = useState(false);
    const [layoutMessage, setLayoutMessage] = useState("");
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
                setDashboardLayout(null);
                setLayoutDraft(null);
                return;
            }

            setDataset(null);
            setAnalysis(null);
            setQualityIssues([]);
            setDashboardLayout(null);
            setLayoutDraft(null);
            setAnalysisMessage("");
            try {
                const token = window.localStorage.getItem("adp-access-token");
                const [result, latestAnalysis, savedLayout] = await Promise.all([
                    apiRequest(
                        `/api/dashboard/datasets/${encodeURIComponent(datasetFilter)}/dashboard`,
                        { token },
                    ),
                    apiRequest(
                        `/api/analysis/datasets/${encodeURIComponent(datasetFilter)}/analysis`,
                        { token },
                    ),
                    apiRequest(
                        `/api/dashboard/datasets/${encodeURIComponent(datasetFilter)}/layout`,
                        { token },
                    ),
                ]);
                if (!isCurrent) return;
                const normalizedLayout = { ...defaultLayout(result.name), ...savedLayout };
                setDataset(result);
                setAnalysis(latestAnalysis);
                setDashboardLayout(normalizedLayout);
                setLayoutDraft(normalizedLayout);
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

    const analysisColumns = analysis?.results?.columns || [];
    const categoricalColumns = analysisColumns.filter(
        (column) => ["categorical", "boolean"].includes(column.inferred_type) && column.top_values?.length,
    );
    const numericColumns = analysisColumns.filter(
        (column) => column.inferred_type === "numeric" && column.statistics,
    );
    const selectedDistributionColumn = categoricalColumns.find(
        (column) => column.name === layoutDraft?.category_column,
    ) || categoricalColumns[0];
    const selectedNumericColumn = numericColumns.find(
        (column) => column.name === layoutDraft?.numeric_column,
    ) || numericColumns[0];
    const visibleWidgets = new Set(layoutDraft?.visible_widgets || DASHBOARD_WIDGETS.map((widget) => widget.id));
    const missingColumns = analysisColumns
        .filter((column) => column.missing_count > 0)
        .sort((first, second) => second.missing_count - first.missing_count)
        .slice(0, 8);

    const accountMetrics = [
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
    const analysisCells = analysis
        ? analysis.results.row_count * analysis.results.column_count
        : 0;
    const analysisQualityScore = analysisCells
        ? Math.round(((analysisCells - analysis.results.missing_cells) / analysisCells) * 100)
        : null;
    const selectedMetrics = analysis ? [
        {
            label: "Rows analyzed",
            value: formatValue(analysis.results.row_count),
            note: dataset?.name || "Selected dataset",
            tone: "green",
        },
        {
            label: "Columns",
            value: formatValue(analysis.results.column_count),
            note: "Fields in this dataset",
            tone: "blue",
        },
        {
            label: "Data quality",
            value: analysisQualityScore === null ? "—" : `${analysisQualityScore}%`,
            note: `${formatValue(analysis.results.missing_cells)} missing cells · ${formatValue(analysis.results.duplicate_rows)} duplicate rows`,
            tone: "violet",
        },
        {
            label: "Duplicate rows",
            value: formatValue(analysis.results.duplicate_rows),
            note: qualityIssues.length
                ? `${qualityIssues.length} quality findings`
                : "No quality findings",
            tone: "amber",
        },
    ] : accountMetrics;

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

    const saveDashboardLayout = async (layoutToSave = layoutDraft) => {
        if (!datasetFilter || !layoutToSave) return;
        setIsSavingDashboard(true);
        setLayoutMessage("");
        try {
            const savedLayout = await apiRequest(
                `/api/dashboard/datasets/${encodeURIComponent(datasetFilter)}/layout`,
                {
                    method: "PUT",
                    token: window.localStorage.getItem("adp-access-token"),
                    body: JSON.stringify(layoutToSave),
                },
            );
            setDashboardLayout(savedLayout);
            setLayoutDraft(savedLayout);
            setIsEditingDashboard(false);
            setLayoutMessage("Your dashboard changes have been saved.");
        } catch (saveError) {
            setLayoutMessage(saveError.message || "The dashboard changes could not be saved.");
        } finally {
            setIsSavingDashboard(false);
        }
    };

    const cancelDashboardEdit = () => {
        setLayoutDraft(dashboardLayout);
        setIsEditingDashboard(false);
        setLayoutMessage("");
    };

    const toggleDashboardWidget = (widgetId) => {
        setLayoutDraft((current) => {
            const visible = new Set(current.visible_widgets);
            if (visible.has(widgetId)) {
                if (visible.size === 1) return current;
                visible.delete(widgetId);
            } else {
                visible.add(widgetId);
            }
            return { ...current, visible_widgets: [...visible] };
        });
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
                    <div><p className="dashboard-eyebrow">ANALYTICAL DASHBOARD</p><h1>{layoutDraft?.title || dataset?.name || "Start with your data"}</h1><p className="workspace-subtitle">{analysis ? `${formatValue(analysis.results.row_count)} rows · ${analysis.results.column_count} columns · analyzed ${new Date(analysis.created_at).toLocaleString()}` : "Upload a dataset to generate charts, quality insights, and a report from your data."}</p></div>
                    <div className="workspace-actions">
                        {analysis && <button className="workspace-analysis-button" type="button" onClick={() => setIsEditingDashboard((editing) => !editing)}>{isEditingDashboard ? "Close editor" : "Customize dashboard"}</button>}
                        {analysis && <button className="workspace-analysis-button" type="button" onClick={() => window.print()}>Print / save dashboard</button>}
                        <button className="workspace-analysis-button" type="button" onClick={runAnalysis} disabled={isAnalyzing || datasetFilter === "all"}>{isAnalyzing ? "Generating…" : analysis ? "Regenerate dashboard" : "Generate dashboard"}</button>
                        <Link className="workspace-primary-button" to="/upload">Upload dataset</Link>
                    </div>
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
                {location.state?.uploadSummary && <section className="analysis-progress-card" role="status">
                    <div className="analysis-progress-copy"><div><strong>Upload complete</strong><p>{location.state.uploadSummary}</p>
                        {location.state.uploadFailures?.map((failure, index) => <p key={`${failure}-${index}`}>{failure}</p>)}
                    </div></div>
                </section>}
                {analysisMessage && <section className="analysis-progress-card" role="status"><div className="analysis-progress-copy"><div><strong>Analysis not started</strong><p>{analysisMessage}</p></div></div></section>}
                {layoutMessage && <p className="dashboard-layout-status" role="status">{layoutMessage}</p>}
                {isEditingDashboard && layoutDraft && <section className="dashboard-editor" aria-label="Customize dashboard">
                    <div className="dashboard-editor-heading"><div><h2>Customize dashboard</h2><p>Choose a title, charts, and columns. Changes are saved to your account.</p></div></div>
                    <label className="dashboard-editor-title">Dashboard title
                        <input
                            aria-label="Dashboard title"
                            maxLength={120}
                            value={layoutDraft.title}
                            onChange={(event) => setLayoutDraft((current) => ({ ...current, title: event.target.value }))}
                        />
                    </label>
                    <fieldset className="dashboard-widget-options">
                        <legend>Visible sections</legend>
                        {DASHBOARD_WIDGETS.map((widget) => (
                            <label key={widget.id}>
                                <input
                                    type="checkbox"
                                    checked={layoutDraft.visible_widgets.includes(widget.id)}
                                    onChange={() => toggleDashboardWidget(widget.id)}
                                    disabled={layoutDraft.visible_widgets.length === 1 && layoutDraft.visible_widgets.includes(widget.id)}
                                />
                                {widget.label}
                            </label>
                        ))}
                    </fieldset>
                    <div className="dashboard-editor-fields">
                        <label>Value distribution column
                            <select
                                aria-label="Value distribution column"
                                value={layoutDraft.category_column || selectedDistributionColumn?.name || ""}
                                onChange={(event) => setLayoutDraft((current) => ({ ...current, category_column: event.target.value || null }))}
                                disabled={!categoricalColumns.length}
                            >
                                {categoricalColumns.map((column) => <option key={column.name} value={column.name}>{column.name}</option>)}
                                {!categoricalColumns.length && <option value="">No category columns</option>}
                            </select>
                        </label>
                        <label>Category chart style
                            <select
                                aria-label="Category chart style"
                                value={layoutDraft.distribution_chart}
                                onChange={(event) => setLayoutDraft((current) => ({ ...current, distribution_chart: event.target.value }))}
                            >
                                <option value="bar">Horizontal bar</option>
                                <option value="column">Column</option>
                                <option value="pie">Pie</option>
                                <option value="donut">Donut</option>
                            </select>
                        </label>
                        <label>Numeric profile column
                            <select
                                aria-label="Numeric profile column"
                                value={layoutDraft.numeric_column || selectedNumericColumn?.name || ""}
                                onChange={(event) => setLayoutDraft((current) => ({ ...current, numeric_column: event.target.value || null }))}
                                disabled={!numericColumns.length}
                            >
                                {numericColumns.map((column) => <option key={column.name} value={column.name}>{column.name}</option>)}
                                {!numericColumns.length && <option value="">No numeric columns</option>}
                            </select>
                        </label>
                    </div>
                    <div className="dashboard-editor-actions">
                        <button className="workspace-primary-button" type="button" onClick={() => saveDashboardLayout()} disabled={isSavingDashboard || !layoutDraft.title.trim()}>{isSavingDashboard ? "Saving…" : "Save dashboard"}</button>
                        <button type="button" className="report-preview-close" onClick={cancelDashboardEdit} disabled={isSavingDashboard}>Cancel</button>
                    </div>
                </section>}
                <section className="metric-grid" aria-label="Workspace summary">{selectedMetrics.map((metric) => <article className={`metric-card metric-${metric.tone}`} key={metric.label}><div className="metric-card-head" /><p>{metric.label}</p><strong>{metric.value}</strong><small>{metric.note}</small></article>)}</section>

                {analysis ? (
                    <div className="workspace-content-grid dataset-dashboard-grid">
                        {(analysisView === "overview" || analysisView === "activity") && visibleWidgets.has("value-distribution") && <article className="dashboard-panel dataset-chart-panel">
                            <div className="panel-heading">
                                <div><h2>Category breakdown</h2><p>Compare the most common groups. Bars compare counts; pie and donut charts compare each group’s share.</p></div>
                                <div className="dataset-chart-heading-controls">
                                    {selectedDistributionColumn && <span className="dataset-chart-selected-column">{selectedDistributionColumn.name}</span>}
                                    <label className="dataset-chart-select">Chart style
                                        <select aria-label="Category chart style" value={layoutDraft?.distribution_chart || "bar"} onChange={(event) => saveDashboardLayout({ ...layoutDraft, distribution_chart: event.target.value })} disabled={isSavingDashboard}>
                                            <option value="bar">Bar</option>
                                            <option value="column">Column</option>
                                            <option value="pie">Pie</option>
                                            <option value="donut">Donut</option>
                                        </select>
                                    </label>
                                </div>
                            </div>
                            {selectedDistributionColumn
                                ? <DistributionChart column={selectedDistributionColumn} chartType={layoutDraft?.distribution_chart || "bar"} />
                                : <p className="dataset-chart-empty">No categorical columns were detected. Use the numeric profile to explore your values.</p>}
                        </article>}
                        {(analysisView === "overview" || analysisView === "activity") && visibleWidgets.has("numeric-profile") && <article className="dashboard-panel dataset-chart-panel">
                            <div className="panel-heading">
                                <div><h2>Numeric profile</h2><p>A quick statistical summary of your selected numeric field.</p></div>
                                {selectedNumericColumn && <span className="dataset-chart-selected-column">{selectedNumericColumn.name}</span>}
                            </div>
                            {selectedNumericColumn
                                ? <NumericProfileChart column={selectedNumericColumn} />
                                : <p className="dataset-chart-empty">No numeric columns were detected in this dataset.</p>}
                        </article>}
                        {(analysisView === "overview" || analysisView === "activity") && visibleWidgets.has("numeric-profile") && <article className="dashboard-panel dataset-chart-panel">
                            <div className="panel-heading">
                                <div><h2>Value histogram</h2><p>See how often values fall within each numeric range.</p></div>
                                {selectedNumericColumn && <span className="dataset-chart-selected-column">{selectedNumericColumn.name}</span>}
                            </div>
                            {selectedNumericColumn
                                ? <HistogramChart column={selectedNumericColumn} />
                                : <p className="dataset-chart-empty">A histogram appears when the dataset contains a numeric column.</p>}
                        </article>}
                        {(analysisView === "overview" || analysisView === "summary") && visibleWidgets.has("missing-values") && <article className="dashboard-panel dataset-chart-panel">
                            <div className="panel-heading"><div><h2>Missing values by column</h2><p>Columns with the most missing values</p></div></div>
                            {missingColumns.length ? (
                                <div className="dataset-chart-bars" role="img" aria-label="Missing values by column">
                                    {missingColumns.map((column) => (
                                        <div className="dataset-chart-row" key={column.name}>
                                            <span className="dataset-chart-label" title={column.name}>{column.name}</span>
                                            <span className="dataset-chart-track"><span className="dataset-chart-bar dataset-chart-bar-warning" style={{ width: `${column.missing_count / Math.max(1, analysis.results.row_count) * 100}%` }} /></span>
                                            <strong>{formatValue(column.missing_count)}</strong>
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="dataset-chart-empty">Great quality: no missing values were detected.</p>}
                        </article>}
                        {(analysisView === "overview" || analysisView === "summary") && visibleWidgets.has("column-overview") && <article className="dashboard-panel dataset-chart-panel">
                            <div className="panel-heading"><div><h2>Column overview</h2><p>Detected data types and unique values</p></div></div>
                            <div className="dataset-columns-table-wrap"><table className="dataset-columns-table">
                                <thead><tr><th scope="col">Column</th><th scope="col">Type</th><th scope="col">Unique</th><th scope="col">Missing</th></tr></thead>
                                <tbody>{analysisColumns.map((column) => <tr key={column.name}>
                                    <td>{column.name}</td><td><span className="dataset-type-pill">{column.inferred_type}</span></td><td>{formatValue(column.unique_count)}</td><td>{formatValue(column.missing_count)}</td>
                                </tr>)}</tbody>
                            </table></div>
                        </article>}
                        {(analysisView === "overview" || analysisView === "summary") && visibleWidgets.has("correlations") && <article className="dashboard-panel dataset-chart-panel dataset-correlation-panel">
                            <div className="panel-heading"><div><h2>Numeric relationships</h2><p>Compare linear relationships between numeric fields.</p></div></div>
                            <CorrelationHeatmap correlations={analysis.results.correlations} />
                        </article>}
                        {visibleWidgets.has("insights") && <article className="dashboard-panel dataset-insight-panel">
                            <div className="panel-heading"><div><h2>What this dataset shows</h2><p>Plain-language highlights from the analysis</p></div><Link to="/reports" className="panel-link">Create a report</Link></div>
                            <ul>
                                <li><strong>{analysis.results.row_count.toLocaleString()}</strong> rows across <strong>{analysis.results.column_count}</strong> columns.</li>
                                {selectedDistributionColumn?.top_values?.[0] && <li><strong>{selectedDistributionColumn.top_values[0].value}</strong> is the most common value in <strong>{selectedDistributionColumn.name}</strong> ({formatValue(selectedDistributionColumn.top_values[0].count)} records).</li>}
                                {selectedNumericColumn?.statistics && <li><strong>{selectedNumericColumn.name}</strong> ranges from {formatValue(selectedNumericColumn.statistics.minimum)} to {formatValue(selectedNumericColumn.statistics.maximum)}; its average is {formatValue(selectedNumericColumn.statistics.mean)}.</li>}
                                {missingColumns.length
                                    ? <li><strong>{missingColumns[0].name}</strong> needs the most attention, with {formatValue(missingColumns[0].missing_count)} blank values.</li>
                                    : <li>Every analyzed field has a value; no missing cells were found.</li>}
                                <li>{formatValue(analysis.results.duplicate_rows)} duplicate rows detected. {qualityIssues.length ? `${qualityIssues.length} quality findings are available to review.` : "No additional quality findings need review."}</li>
                            </ul>
                        </article>}
                    </div>
                ) : (
                    <div className="workspace-content-grid">
                        <article className="dashboard-panel dataset-empty-panel">
                            <h2>{dataset ? "Your dataset is ready" : "Your dashboard is ready"}</h2>
                            <p>{dataset ? `${dataset.name} is uploaded. Generate a dashboard to create charts, column insights, and quality findings.` : "Upload a dataset, then choose Generate dashboard to create charts and quality insights from your data."}</p>
                            {dataset
                                ? <button className="workspace-primary-button" type="button" onClick={runAnalysis} disabled={isAnalyzing}>{isAnalyzing ? "Generating dashboard…" : "Generate dashboard"}</button>
                                : <Link className="workspace-primary-button" to="/upload">Upload dataset</Link>}
                        </article>
                        {analysisView === "overview" && <article className="dashboard-panel dataset-insight-panel">
                            <div className="panel-heading"><div><h2>Recent activity</h2><p>Your generated dashboards and reports will appear here.</p></div><Link to="/reports" className="panel-link">View reports</Link></div>
                            <p>{reports.length ? `${reports.length} report${reports.length === 1 ? "" : "s"} available.` : "Your first report will appear here after analysis."}</p>
                        </article>}
                    </div>
                )}
            </section>
        </main>
    );
}

function Dashboard() {
    const location = useLocation();
    const queryIds = new URLSearchParams(location.search).get("datasets");
    const requestedIds = location.state?.datasetIds?.length
        ? location.state.datasetIds
        : (queryIds || "").split(",");
    const datasetIds = [...new Set(requestedIds.map(String).filter(Boolean))];

    return datasetIds.length > 1
        ? <FolderDashboard datasetIds={datasetIds} location={location} />
        : <SingleDatasetDashboard />;
}

export default Dashboard;
