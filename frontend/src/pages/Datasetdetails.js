import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiRequest } from "../api/client";

function Datasetdetails() {
    const { datasetId } = useParams();
    const [dataset, setDataset] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => {
        let isCurrent = true;
        const token = window.localStorage.getItem("adp-access-token");
        Promise.all([
            apiRequest(`/api/datasets/${encodeURIComponent(datasetId)}`, { token }),
            apiRequest(`/api/analysis/datasets/${encodeURIComponent(datasetId)}/analysis`, { token }),
        ])
            .then(([datasetResult, analysisResult]) => {
                if (!isCurrent) return;
                setDataset(datasetResult);
                setAnalysis(analysisResult);
            })
            .catch((loadError) => {
                if (isCurrent) setError(loadError.message || "Dataset details could not be loaded.");
            })
            .finally(() => {
                if (isCurrent) setIsLoading(false);
            });
        return () => {
            isCurrent = false;
        };
    }, [datasetId]);

    const runAnalysis = async () => {
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
            setAnalysis(result);
            setMessage(`Analysis complete. ${result.quality_issue_count} quality finding${result.quality_issue_count === 1 ? "" : "s"} detected.`);
        } catch (analysisError) {
            setError(analysisError.message || "The dataset could not be analyzed.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <main className="catalog-page">
            <header className="catalog-heading">
                <div>
                    <p className="dashboard-eyebrow">WORKSPACE / DATASET DETAILS</p>
                    <h1>{isLoading ? "Loading dataset…" : dataset?.name || "Dataset details"}</h1>
                    <p>Review the uploaded file, preview its columns and rows, and open its analysis.</p>
                </div>
                <div className="catalog-heading-actions">
                    <Link className="reports-back-link" to="/datasets">Back to data catalogue</Link>
                    <Link className="reports-back-link" to="/dashboard">Back to dashboard</Link>
                </div>
            </header>

            {error && <p className="reports-status" role="alert">{error}</p>}
            {message && <p className="reports-status" role="status">{message}</p>}
            {isLoading ? (
                <p className="reports-status" role="status">Loading dataset details…</p>
            ) : dataset ? (
                <>
                    <section className="dataset-detail-summary" aria-label="Dataset summary">
                        <div><span>File</span><strong>{dataset.original_filename}</strong></div>
                        <div><span>Format</span><strong>{dataset.file_type?.toUpperCase() || "Unknown"}</strong></div>
                        <div><span>Rows</span><strong>{dataset.row_count?.toLocaleString() ?? "—"}</strong></div>
                        <div><span>Columns</span><strong>{dataset.column_count?.toLocaleString() ?? "—"}</strong></div>
                        <div><span>Missing cells</span><strong>{dataset.missing_cells?.toLocaleString() ?? "—"}</strong></div>
                        <div><span>Uploaded</span><strong>{new Date(dataset.created_at).toLocaleString()}</strong></div>
                    </section>

                    <section className="dataset-detail-actions" aria-label="Dataset actions">
                        <button className="workspace-primary-button" type="button" onClick={runAnalysis} disabled={isAnalyzing}>
                            {isAnalyzing ? "Analyzing…" : "Run analysis"}
                        </button>
                        {analysis && (
                            <>
                                <Link className="reports-back-link" to={`/quality?dataset=${dataset.id}`}>Review quality findings</Link>
                                <Link className="reports-back-link" to="/reports">Create or view reports</Link>
                            </>
                        )}
                    </section>

                    {analysis && (
                        <section className="dataset-analysis-card" aria-label="Latest analysis">
                            <h2>Latest analysis</h2>
                            <p>Completed {new Date(analysis.created_at).toLocaleString()}</p>
                            <p>{analysis.quality_issue_count} quality finding{analysis.quality_issue_count === 1 ? "" : "s"} detected.</p>
                            {analysis.results && (
                                <pre>{JSON.stringify(analysis.results, null, 2)}</pre>
                            )}
                        </section>
                    )}

                    <section className="dataset-preview" aria-label="Dataset preview">
                        <div className="dataset-preview-heading">
                            <div><h2>Data preview</h2><p>First rows from the currently stored dataset version.</p></div>
                            <span>{dataset.version_number ? `Version ${dataset.version_number}` : "Latest version"}</span>
                        </div>
                        {dataset.preview_rows.length ? (
                            <div className="dataset-preview-scroll">
                                <table>
                                    <thead><tr>{dataset.headers.map((header, index) => <th key={`${header}-${index}`}>{header}</th>)}</tr></thead>
                                    <tbody>
                                        {dataset.preview_rows.map((row, rowIndex) => (
                                            <tr key={rowIndex}>{row.map((value, columnIndex) => <td key={`${rowIndex}-${columnIndex}`}>{value || "—"}</td>)}</tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : <p className="reports-status">No preview rows are available.</p>}
                    </section>
                </>
            ) : null}
        </main>
    );
}

export default Datasetdetails;
