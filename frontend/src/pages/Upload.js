import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = [
    "csv", "tsv", "txt", "xlsx", "xls", "ods", "json", "jsonl", "xml",
    "parquet", "feather", "orc", "avro", "sas7bdat", "xpt", "sav", "dta",
    "dbf", "geojson", "sqlite", "sqlite3", "db", "ndjson",
];

function Upload() {
    const navigate = useNavigate();
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [error, setError] = useState("");
    const [isReading, setIsReading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const readFile = async (selectedFile) => {
        setFile(selectedFile || null);
        setPreview(null);
        setError("");
        if (!selectedFile) return;

        const extension = selectedFile.name.split(".").pop().toLowerCase();
        if (!SUPPORTED_EXTENSIONS.includes(extension)) {
            setError("Choose one of the supported data formats shown below.");
            return;
        }
        if (selectedFile.size > MAX_FILE_SIZE) {
            setError("This preview supports files up to 10 MB. Choose a smaller file.");
            return;
        }
        if (selectedFile.size === 0) {
            setError("The selected file is empty.");
            return;
        }

        setIsReading(true);
        try {
            const formData = new FormData();
            formData.append("file", selectedFile);
            const result = await apiRequest("/api/datasets/preview", {
                method: "POST",
                body: formData,
                token: window.localStorage.getItem("adp-access-token"),
            });
            setPreview({
                headers: result.headers,
                rows: result.preview_rows,
                rowCount: result.row_count,
                missingCells: result.missing_cells,
                columnCount: result.column_count,
                delimiter: extension.toUpperCase(),
            });
        } catch (readError) {
            setError(readError.message || "The selected file could not be read.");
        } finally {
            setIsReading(false);
        }
    };

    const saveDataset = async (event) => {
        event.preventDefault();
        if (!file || !preview) return;
        setError("");
        setIsSaving(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const result = await apiRequest("/api/datasets/upload", {
                method: "POST",
                body: formData,
                token: window.localStorage.getItem("adp-access-token"),
            });
            navigate("/dashboard", { state: { datasetId: result.id } });
        } catch (saveError) {
            setError(saveError.message || "The dataset could not be uploaded.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <section className="upload-page" aria-labelledby="upload-heading">
            <div className="upload-heading">
                <div>
                    <p className="dashboard-eyebrow">WORKSPACE / UPLOAD DATA</p>
                    <h1 id="upload-heading">Prepare a dataset</h1>
                    <p>Choose a supported data file to check its columns and preview the first rows before continuing.</p>
                </div>
                <Link className="reports-back-link" to="/dashboard">Back to dashboard</Link>
            </div>

            <form className="upload-panel" onSubmit={saveDataset}>
                <label className="upload-file-field" htmlFor="dataset-file">
                    <strong>Select a data file</strong>
                    <span>20 formats including CSV, Excel, JSON, Parquet, SAS and SQLite · up to 10 MB</span>
                    <input id="dataset-file" type="file" accept={SUPPORTED_EXTENSIONS.map((extension) => `.${extension}`).join(",")} onChange={(event) => readFile(event.target.files?.[0])} />
                </label>
                {file && <p className="upload-selected-file">Selected: <strong>{file.name}</strong>{isReading ? " · Reading file…" : ""}</p>}
                {error && <p className="upload-message upload-error" role="alert">{error}</p>}

                {preview && <section className="upload-preview" aria-labelledby="upload-preview-heading">
                    <div className="upload-preview-heading">
                        <div><h2 id="upload-preview-heading">File preview</h2><p>{preview.rowCount.toLocaleString()} rows · {preview.columnCount} columns · {preview.delimiter}</p></div>
                        <span>{preview.missingCells ? `${preview.missingCells} blank cells found` : "No blank cells in this file"}</span>
                    </div>
                    <div className="upload-table-wrap"><table className="home-data-table"><thead><tr>{preview.headers.map((heading) => <th scope="col" key={heading}>{heading}</th>)}</tr></thead><tbody>{preview.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((value, columnIndex) => <td key={`${rowIndex}-${columnIndex}`}>{value || <em>Blank</em>}</td>)}</tr>)}</tbody></table></div>
                    {preview.rowCount > preview.rows.length && <p className="upload-preview-note">Showing the first {preview.rows.length} rows. All {preview.rowCount.toLocaleString()} rows are included in the saved file summary.</p>}
                    <button className="workspace-primary-button" type="submit" disabled={isSaving}>{isSaving ? "Saving dataset…" : "Continue to dashboard"}</button>
                </section>}
                <p className="upload-local-note">Your dataset will be saved to your private workspace when you continue.</p>
            </form>
        </section>
    );
}

export default Upload;
