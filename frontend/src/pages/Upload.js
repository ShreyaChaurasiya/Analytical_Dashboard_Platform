import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function parseDelimited(text, delimiter) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;

    for (let i = 0; i < text.length; i += 1) {
        const character = text[i];
        if (character === '"') {
            if (quoted && text[i + 1] === '"') {
                cell += '"';
                i += 1;
            } else {
                quoted = !quoted;
            }
        } else if (!quoted && character === delimiter) {
            row.push(cell);
            cell = "";
        } else if (!quoted && (character === "\n" || character === "\r")) {
            if (character === "\r" && text[i + 1] === "\n") i += 1;
            row.push(cell);
            if (row.some((value) => value.trim() !== "")) rows.push(row);
            row = [];
            cell = "";
        } else {
            cell += character;
        }
    }

    if (quoted) throw new Error("The file has an unclosed quotation mark.");
    row.push(cell);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
    return rows;
}

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
        if (!["csv", "tsv"].includes(extension)) {
            setError("Choose a .csv or .tsv file. Excel workbooks are not supported by this upload screen yet.");
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
            const delimiter = extension === "tsv" ? "\t" : ",";
            const parsed = parseDelimited((await selectedFile.text()).replace(/^\uFEFF/, ""), delimiter);
            const headers = (parsed.shift() || []).map((value) => value.trim());
            if (!headers.length || headers.some((value) => !value)) throw new Error("Every column needs a name in the first row.");
            if (new Set(headers.map((value) => value.toLowerCase())).size !== headers.length) throw new Error("Column names must be unique.");
            if (!parsed.length) throw new Error("Add at least one data row after the column headings.");

            const normalizedRows = parsed.map((values, index) => {
                if (values.length > headers.length && values.slice(headers.length).some((value) => value.trim())) {
                    throw new Error(`Row ${index + 2} has more values than the ${headers.length} column headings.`);
                }
                return Array.from({ length: headers.length }, (_, column) => (values[column] || "").trim());
            });
            const missingCells = normalizedRows.reduce((count, values) => count + values.filter((value) => !value).length, 0);
            setPreview({ headers, rows: normalizedRows.slice(0, 10), rowCount: normalizedRows.length, missingCells, columnCount: headers.length, delimiter: extension.toUpperCase() });
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
                    <p>Choose a CSV or TSV file to check its columns and preview the first rows before continuing.</p>
                </div>
                <Link className="reports-back-link" to="/dashboard">Back to dashboard</Link>
            </div>

            <form className="upload-panel" onSubmit={saveDataset}>
                <label className="upload-file-field" htmlFor="dataset-file">
                    <strong>Select a data file</strong>
                    <span>CSV or TSV · up to 10 MB</span>
                    <input id="dataset-file" type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={(event) => readFile(event.target.files?.[0])} />
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
