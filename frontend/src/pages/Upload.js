import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = [
    "csv", "tsv", "txt", "xlsx", "xls", "ods", "json", "jsonl", "xml",
    "parquet", "feather", "orc", "avro", "sas7bdat", "xpt", "sav", "dta",
    "dbf", "geojson", "sqlite", "sqlite3", "db", "ndjson",
];
const ACCEPTED_FILES = SUPPORTED_EXTENSIONS.map((extension) => `.${extension}`).join(",");

function getFileKey(file) {
    return file.webkitRelativePath || `${file.name} (${file.size} bytes, ${file.lastModified})`;
}

function getExtension(file) {
    return file.name.split(".").pop().toLowerCase();
}

function Upload() {
    const navigate = useNavigate();
    const [files, setFiles] = useState([]);
    const [error, setError] = useState("");
    const [selectionNotice, setSelectionNotice] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const addFiles = (selectedFiles) => {
        setError("");
        const addedFiles = [];
        const skippedFiles = [];
        const existingKeys = new Set(files.map(getFileKey));

        Array.from(selectedFiles).forEach((selectedFile) => {
            const reason = !SUPPORTED_EXTENSIONS.includes(getExtension(selectedFile))
                ? "unsupported format"
                : selectedFile.size > MAX_FILE_SIZE
                    ? "over 2 GB"
                    : selectedFile.size === 0
                        ? "empty"
                        : "";
            if (reason) {
                skippedFiles.push(`${selectedFile.name} (${reason})`);
            } else if (!existingKeys.has(getFileKey(selectedFile))) {
                addedFiles.push(selectedFile);
                existingKeys.add(getFileKey(selectedFile));
            }
        });

        if (addedFiles.length) {
            setFiles((current) => [...current, ...addedFiles]);
        }
        const skippedSummary = skippedFiles.slice(0, 5).join(", ");
        const additionalCount = skippedFiles.length - 5;
        setSelectionNotice(skippedFiles.length
            ? `Skipped ${skippedFiles.length} file${skippedFiles.length === 1 ? "" : "s"}: ${skippedSummary}${additionalCount > 0 ? ` and ${additionalCount} more` : ""}.`
            : "");
        if (!addedFiles.length && !files.length) {
            setError("No supported, non-empty files up to 2 GB were selected.");
        }
    };

    const clearSelection = () => {
        setFiles([]);
        setError("");
        setSelectionNotice("");
    };

    const saveDataset = async (event) => {
        event.preventDefault();
        if (!files.length) return;
        setError("");
        setIsSaving(true);
        const uploaded = [];
        const failures = [];

        for (const selectedFile of files) {
            try {
                const formData = new FormData();
                formData.append("file", selectedFile);
                const dataset = await apiRequest("/api/datasets/upload", {
                    method: "POST",
                    body: formData,
                    token: window.localStorage.getItem("adp-access-token"),
                });
                uploaded.push(dataset);
            } catch (uploadError) {
                failures.push(`${selectedFile.name}: upload failed (${uploadError.message}).`);
                if (uploadError.status === 401) break;
            }
        }

        setIsSaving(false);
        if (!uploaded.length) {
            setError(`No files were uploaded. ${failures.join(" ")}`);
            return;
        }

        const datasetIds = uploaded.map((dataset) => dataset.id);
        navigate(`/dashboard?datasets=${datasetIds.join(",")}`, {
            state: {
                datasetId: uploaded[0].id,
                datasetIds,
                uploadSummary: `${uploaded.length} of ${files.length} files uploaded. Generate one folder dashboard to analyze all uploaded files together. Each file stays in its own section so unrelated tables are not mixed.`,
                uploadFailures: failures,
            },
        });
    };

    return (
        <section className="upload-page" aria-labelledby="upload-heading">
            <div className="upload-heading">
                <div>
                    <p className="dashboard-eyebrow">WORKSPACE / UPLOAD DATA</p>
                    <h1 id="upload-heading">Prepare datasets</h1>
                    <p>Select multiple data files or a folder. Generate one dashboard for the whole selection; each file gets its own section so unrelated tables are not incorrectly combined. Create reports separately.</p>
                </div>
                <Link className="reports-back-link" to="/dashboard">Back to dashboard</Link>
            </div>

            <form className="upload-panel" onSubmit={saveDataset}>
                <label className="upload-file-field" htmlFor="dataset-files">
                    <strong>Select multiple data files</strong>
                    <span>Choose one or more files. Supported formats: CSV, Excel, JSON, Parquet, SAS and more · up to 2 GB per file</span>
                    <input
                        id="dataset-files"
                        type="file"
                        accept={ACCEPTED_FILES}
                        multiple
                        disabled={isSaving}
                        onChange={(event) => {
                            addFiles(event.target.files);
                            event.target.value = "";
                        }}
                    />
                </label>
                <label className="upload-file-field" htmlFor="dataset-folder">
                    <strong>Select a folder</strong>
                    <span>All supported data files in the selected folder will be added.</span>
                    <input
                        id="dataset-folder"
                        type="file"
                        accept={ACCEPTED_FILES}
                        multiple
                        webkitdirectory=""
                        disabled={isSaving}
                        onChange={(event) => {
                            addFiles(event.target.files);
                            event.target.value = "";
                        }}
                    />
                </label>
                {files.length > 0 && (
                    <div className="upload-selected-file">
                        <p>{files.length} data file{files.length === 1 ? "" : "s"} selected</p>
                        <ul>
                            {files.slice(0, 5).map((item) => (
                                <li key={getFileKey(item)}>{getFileKey(item)} · {(item.size / (1024 * 1024)).toFixed(1)} MB</li>
                            ))}
                        </ul>
                        {files.length > 5 && <p>and {files.length - 5} more file{files.length === 6 ? "" : "s"}</p>}
                        <button className="panel-link" type="button" onClick={clearSelection} disabled={isSaving}>Clear selection</button>
                    </div>
                )}
                {selectionNotice && <p className="upload-message" role="status">{selectionNotice}</p>}
                {error && <p className="upload-message upload-error" role="alert">{error}</p>}

                <button className="workspace-primary-button" type="submit" disabled={isSaving || !files.length}>
                    {isSaving ? `Uploading ${files.length} dataset${files.length === 1 ? "" : "s"}…` : `Upload ${files.length || ""} dataset${files.length === 1 ? "" : "s"}`}
                </button>
                <p className="upload-local-note">Files are stored as separate datasets, then analyzed together in one folder dashboard when you choose Generate dashboard. Source files are preserved.</p>
            </form>
        </section>
    );
}

export default Upload;
