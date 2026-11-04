import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";

function Datasets() {
    const [datasets, setDatasets] = useState([]);
    const [search, setSearch] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let isCurrent = true;
        apiRequest("/api/datasets", {
            token: window.localStorage.getItem("adp-access-token"),
        })
            .then((result) => {
                if (isCurrent) setDatasets(result);
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
    }, []);

    const visibleDatasets = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return datasets;
        return datasets.filter((dataset) => (
            dataset.name.toLowerCase().includes(query)
            || dataset.original_filename.toLowerCase().includes(query)
            || (dataset.file_type || "").toLowerCase().includes(query)
        ));
    }, [datasets, search]);

    return (
        <main className="catalog-page">
            <header className="catalog-heading">
                <div>
                    <p className="dashboard-eyebrow">WORKSPACE / DATA CATALOGUE</p>
                    <h1>Your datasets</h1>
                    <p>Browse uploaded files and open a dataset to review its preview and analysis.</p>
                </div>
                <div className="catalog-heading-actions">
                    <Link className="reports-back-link" to="/dashboard">Back to dashboard</Link>
                    <Link className="workspace-primary-button" to="/upload">Upload dataset</Link>
                </div>
            </header>

            <label className="catalog-search">
                Search datasets
                <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by name, filename, or format"
                />
            </label>

            {error && <p className="reports-status" role="alert">{error}</p>}
            {isLoading ? (
                <p className="reports-status" role="status">Loading datasets…</p>
            ) : visibleDatasets.length ? (
                <section className="catalog-list" aria-label="Your datasets">
                    {visibleDatasets.map((dataset) => (
                        <article className="catalog-card" key={dataset.id}>
                            <div className="catalog-file-badge" aria-hidden="true">
                                {(dataset.file_type || "DATA").slice(0, 4).toUpperCase()}
                            </div>
                            <div className="catalog-card-details">
                                <span className="report-card-type">{dataset.file_type || "DATA"} DATASET</span>
                                <h2><Link to={`/datasets/${dataset.id}`}>{dataset.name}</Link></h2>
                                <p>{dataset.original_filename} · Uploaded {new Date(dataset.created_at).toLocaleString()}</p>
                                <div className="catalog-stats">
                                    <span>{dataset.row_count ?? "—"} rows</span>
                                    <span>{dataset.column_count ?? "—"} columns</span>
                                    <span>{dataset.file_size == null ? "Size unknown" : `${(dataset.file_size / 1024).toFixed(1)} KB`}</span>
                                </div>
                            </div>
                            <Link className="reports-back-link" to={`/datasets/${dataset.id}`}>Open dataset</Link>
                        </article>
                    ))}
                </section>
            ) : datasets.length ? (
                <section className="reports-empty" aria-label="No matching datasets">
                    <h2>No matching datasets</h2>
                    <p>Try a different search term.</p>
                </section>
            ) : (
                <section className="reports-empty" aria-label="No datasets">
                    <h2>No datasets uploaded yet</h2>
                    <p>Upload a supported data file to begin exploring and analyzing it.</p>
                    <Link className="workspace-primary-button" to="/upload">Upload dataset</Link>
                </section>
            )}
        </main>
    );
}

export default Datasets;
