import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiRequest } from "../api/client";

function Quality() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [datasets, setDatasets] = useState([]);
    const [datasetId, setDatasetId] = useState(searchParams.get("dataset") || "");
    const [issues, setIssues] = useState([]);
    const [analysis, setAnalysis] = useState(null);
    const [needsAnalysis, setNeedsAnalysis] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingFindings, setIsLoadingFindings] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => {
        let isCurrent = true;
        apiRequest("/api/datasets", { token: window.localStorage.getItem("adp-access-token") })
            .then((result) => {
                if (!isCurrent) return;
                setDatasets(result);
                const requestedId = searchParams.get("dataset");
                const initialId = result.some((item) => String(item.id) === requestedId)
                    ? requestedId
                    : result.length ? String(result[0].id) : "";
                setDatasetId(initialId);
                if (initialId !== requestedId) {
                    setSearchParams(initialId ? { dataset: initialId } : {}, { replace: true });
                }
            })
            .catch((loadError) => {
                if (isCurrent) setError(loadError.message || "Datasets could not be loaded.");
            })
            .finally(() => {
                if (isCurrent) setIsLoading(false);
            });
        return () => {
            isCurrent = false;
        };
    }, [searchParams, setSearchParams]);

    useEffect(() => {
        let isCurrent = true;
        if (!datasetId) {
            setIssues([]);
            setAnalysis(null);
            setNeedsAnalysis(false);
            return () => {
                isCurrent = false;
            };
        }

        setIsLoadingFindings(true);
        setError("");
        setMessage("");
        setIssues([]);
        setAnalysis(null);
        setNeedsAnalysis(false);
        const token = window.localStorage.getItem("adp-access-token");
        Promise.all([
            apiRequest(`/api/analysis/datasets/${encodeURIComponent(datasetId)}/analysis`, { token }),
            apiRequest(`/api/quality/datasets/${encodeURIComponent(datasetId)}/issues`, { token }),
        ])
            .then(([analysisResult, issueRows]) => {
                if (!isCurrent) return;
                setAnalysis(analysisResult);
                setIssues(issueRows);
                setNeedsAnalysis(!analysisResult);
            })
            .catch((loadError) => {
                if (!isCurrent) return;
                if (loadError.message.toLowerCase().includes("run an analysis")) {
                    setNeedsAnalysis(true);
                    return;
                }
                setError(loadError.message || "Quality findings could not be loaded.");
            })
            .finally(() => {
                if (isCurrent) setIsLoadingFindings(false);
            });
        return () => {
            isCurrent = false;
        };
    }, [datasetId]);

    const selectedDataset = useMemo(
        () => datasets.find((dataset) => String(dataset.id) === datasetId),
        [datasets, datasetId],
    );

    const selectDataset = (event) => {
        const value = event.target.value;
        setDatasetId(value);
        setSearchParams(value ? { dataset: value } : {});
    };

    const runAnalysis = async () => {
        if (!datasetId) return;
        setIsAnalyzing(true);
        setError("");
        setMessage("");
        try {
            const result = await apiRequest(
                `/api/analysis/datasets/${encodeURIComponent(datasetId)}/analysis`,
                {
                    method: "POST",
                    token: window.localStorage.getItem("adp-access-token"),
                },
            );
            const issueRows = await apiRequest(
                `/api/quality/datasets/${encodeURIComponent(datasetId)}/issues`,
                { token: window.localStorage.getItem("adp-access-token") },
            );
            setAnalysis(result);
            setIssues(issueRows);
            setNeedsAnalysis(false);
            setMessage("Quality checks are complete.");
        } catch (analysisError) {
            setError(analysisError.message || "Quality analysis could not be completed.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <main className="catalog-page">
            <header className="catalog-heading">
                <div>
                    <p className="dashboard-eyebrow">WORKSPACE / QUALITY CHECKS</p>
                    <h1>Data quality</h1>
                    <p>Review the latest findings for your selected dataset and rerun checks when the data changes.</p>
                </div>
                <div className="catalog-heading-actions">
                    <Link className="reports-back-link" to="/dashboard">Back to dashboard</Link>
                    {selectedDataset && <Link className="reports-back-link" to={`/datasets/${selectedDataset.id}`}>Dataset details</Link>}
                </div>
            </header>

            <section className="quality-selection">
                <label className="reports-field">
                    Dataset
                    <select aria-label="Dataset for quality checks" value={datasetId} onChange={selectDataset} disabled={isLoading || !datasets.length}>
                        {datasets.length
                            ? datasets.map((dataset) => <option value={dataset.id} key={dataset.id}>{dataset.name}</option>)
                            : <option value="">No datasets available</option>}
                    </select>
                </label>
                {datasetId && (
                    <button className="workspace-primary-button" type="button" onClick={runAnalysis} disabled={isAnalyzing || isLoadingFindings}>
                        {isAnalyzing ? "Checking data…" : analysis ? "Run checks again" : "Run quality checks"}
                    </button>
                )}
            </section>

            {error && <p className="reports-status" role="alert">{error}</p>}
            {message && <p className="reports-status" role="status">{message}</p>}
            {isLoading ? (
                <p className="reports-status" role="status">Loading datasets…</p>
            ) : !datasets.length ? (
                <section className="reports-empty" aria-label="No datasets to check">
                    <h2>Upload data to begin quality checks</h2>
                    <p>After upload, select a dataset and run its quality analysis.</p>
                    <Link className="workspace-primary-button" to="/upload">Upload dataset</Link>
                </section>
            ) : isLoadingFindings ? (
                <p className="reports-status" role="status">Loading the latest quality findings…</p>
            ) : needsAnalysis ? (
                <section className="reports-empty" aria-label="Analysis required">
                    <h2>No quality analysis yet</h2>
                    <p>Run quality checks to inspect missing values and other detected data issues.</p>
                </section>
            ) : (
                <>
                    <section className="quality-summary" aria-label="Quality check summary">
                        <div><span>Findings</span><strong>{issues.length}</strong></div>
                        <div><span>Rows in dataset</span><strong>{selectedDataset?.row_count?.toLocaleString() ?? "—"}</strong></div>
                        <div><span>Last checked</span><strong>{analysis ? new Date(analysis.created_at).toLocaleString() : "—"}</strong></div>
                    </section>
                    {issues.length ? (
                        <section className="quality-issue-list" aria-label="Quality findings">
                            {issues.map((issue) => (
                                <article className="quality-issue-card" key={issue.id}>
                                    <div className="quality-issue-heading">
                                        <span className={`quality-severity severity-${issue.severity.toLowerCase()}`}>{issue.severity}</span>
                                        <span>{issue.issue_type.replaceAll("_", " ")}</span>
                                    </div>
                                    <h2>{issue.description}</h2>
                                    <p>
                                        {issue.column_name ? `Column: ${issue.column_name} · ` : ""}
                                        {issue.affected_rows.toLocaleString()} affected row{issue.affected_rows === 1 ? "" : "s"}
                                    </p>
                                    <details>
                                        <summary>Finding details</summary>
                                        <pre>{JSON.stringify(issue.details, null, 2)}</pre>
                                    </details>
                                </article>
                            ))}
                        </section>
                    ) : (
                        <section className="reports-empty" aria-label="No quality issues">
                            <h2>No quality issues found</h2>
                            <p>The latest analysis did not identify any findings for this dataset.</p>
                        </section>
                    )}
                </>
            )}
        </main>
    );
}

export default Quality;
