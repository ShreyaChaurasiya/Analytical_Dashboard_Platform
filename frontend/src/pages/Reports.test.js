import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { apiRequest } from "../api/client";
import Reports from "./Reports";

jest.mock("../api/client", () => ({
    API_BASE_URL: "",
    apiRequest: jest.fn(),
}));

test("generates and previews an Excel report before downloading it", async () => {
    const report = {
        id: 21,
        dataset_id: 8,
        dataset_name: "Monthly data",
        format: "xlsx",
        created_at: "2026-11-05T05:00:00Z",
    };
    apiRequest.mockImplementation(async (path, options = {}) => {
        if (path === "/api/datasets") return [{ id: 8, name: "Monthly data" }];
        if (path === "/api/reports") return [];
        if (path === "/api/settings") return { dashboard_report_format: "pdf" };
        if (path === "/api/reports/datasets/8/reports" && options.method === "POST") return report;
        if (path === "/api/reports/reports/21/preview") {
            return {
                ...report,
                row_count: 12,
                column_count: 2,
                missing_cells: 1,
                duplicate_rows: 0,
                columns: [
                    {
                        name: "month",
                        inferred_type: "categorical",
                        missing_count: 0,
                        unique_count: 12,
                        statistics: null,
                        top_values: [{ value: "Jan", count: 1 }],
                    },
                    {
                        name: "revenue",
                        inferred_type: "numeric",
                        missing_count: 1,
                        unique_count: 11,
                        statistics: { mean: 45, minimum: 10, maximum: 80 },
                        top_values: [],
                    },
                ],
                quality_issues: [],
            };
        }
        throw new Error(`Unexpected request: ${path}`);
    });
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    window.localStorage.setItem("adp-access-token", "test-token");

    render(
        <MemoryRouter initialEntries={["/reports"]}>
            <Reports />
        </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText("Report format"), { target: { value: "xlsx" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate and preview" }));

    expect(await screen.findByText("This is a content preview of the Excel workbook. Download the report to open its formatted worksheets.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Column analysis" })).toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download report" })).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith(
        "/api/reports/reports/21/preview",
        expect.objectContaining({ token: "test-token" }),
    );
    expect(fetchMock).not.toHaveBeenCalled();

    window.localStorage.clear();
});

test("shows a PDF in the report preview without triggering a download", async () => {
    const report = {
        id: 22,
        dataset_id: 8,
        dataset_name: "Monthly data",
        format: "pdf",
        created_at: "2026-11-05T05:00:00Z",
    };
    apiRequest.mockImplementation(async (path, options = {}) => {
        if (path === "/api/datasets") return [{ id: 8, name: "Monthly data" }];
        if (path === "/api/reports") return [];
        if (path === "/api/settings") return { dashboard_report_format: "pdf" };
        if (path === "/api/reports/datasets/8/reports" && options.method === "POST") return report;
        if (path === "/api/reports/reports/22/preview") {
            return {
                ...report,
                row_count: 12,
                column_count: 2,
                missing_cells: 1,
                duplicate_rows: 0,
                columns: [],
                quality_issues: [],
            };
        }
        throw new Error(`Unexpected request: ${path}`);
    });
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = jest.fn(() => "blob:report-preview");
    URL.revokeObjectURL = jest.fn();
    const fetchMock = jest.fn(async () => ({
        ok: true,
        blob: async () => new Blob(["pdf preview"]),
    }));
    global.fetch = fetchMock;
    window.localStorage.setItem("adp-access-token", "test-token");

    const { unmount } = render(
        <MemoryRouter initialEntries={["/reports"]}>
            <Reports />
        </MemoryRouter>,
    );

    const generateButton = await screen.findByRole("button", { name: "Generate and preview" });
    await waitFor(() => expect(generateButton).toBeEnabled());
    fireEvent.click(generateButton);

    expect(await screen.findByTitle("PDF report preview for Monthly data")).toHaveAttribute("src", "blob:report-preview");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Download report" })).toBeInTheDocument();

    unmount();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    window.localStorage.clear();
});
