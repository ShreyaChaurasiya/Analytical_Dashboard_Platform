import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { apiRequest } from "../api/client";
import Dashboard from "./Dashboard";

jest.mock("../api/client", () => ({
    API_BASE_URL: "",
    apiRequest: jest.fn(),
}));

test("builds charts and insights from a selected dataset analysis", async () => {
    const dataset = {
        id: 5,
        name: "Monthly sales",
        original_filename: "sales.csv",
        file_type: "csv",
        file_size: 128,
        status: "uploaded",
        created_at: "2026-11-05T00:00:00Z",
        row_count: 3,
        column_count: 2,
        missing_cells: 1,
        version_number: 1,
        headers: ["region", "revenue"],
        preview_rows: [["North", "12"]],
    };
    const analysis = {
        id: 9,
        dataset_id: 5,
        created_at: "2026-11-05T00:01:00Z",
        quality_issue_count: 1,
        results: {
            row_count: 3,
            column_count: 2,
            missing_cells: 1,
            duplicate_rows: 0,
            columns: [
                {
                    name: "region",
                    inferred_type: "categorical",
                    missing_count: 0,
                    unique_count: 2,
                    statistics: null,
                    top_values: [{ value: "North", count: 2 }, { value: "South", count: 1 }],
                },
                {
                    name: "revenue",
                    inferred_type: "numeric",
                    missing_count: 1,
                    unique_count: 2,
                    statistics: { mean: 15, median: 15, minimum: 12, maximum: 18 },
                    histogram: [{ start: 12, end: 15, count: 2 }, { start: 15, end: 18, count: 1 }],
                    top_values: [],
                },
            ],
            correlations: {
                revenue: { revenue: 1, cost: -0.5 },
                cost: { revenue: -0.5, cost: 1 },
            },
        },
    };
    apiRequest.mockImplementation(async (path, options = {}) => {
        if (path === "/api/datasets") return [dataset];
        if (path === "/api/reports" || path === "/api/dashboard/exports") return [];
        if (path === "/api/settings") {
            return {
                dashboard_default_dataset_id: 5,
                dashboard_analysis_view: "overview",
                dashboard_time_range: "all",
            };
        }
        if (path.endsWith("/layout")) {
            if (options.method === "PUT") return JSON.parse(options.body);
            return {
                title: "Monthly sales",
                visible_widgets: ["value-distribution", "numeric-profile", "missing-values", "column-overview", "insights", "correlations"],
                category_column: "region",
                numeric_column: "revenue",
                distribution_chart: "bar",
            };
        }
        if (path.endsWith("/dashboard")) return dataset;
        if (path.endsWith("/analysis")) return analysis;
        if (path.endsWith("/issues")) return [];
        throw new Error(`Unexpected request: ${path}`);
    });

    render(
        <MemoryRouter initialEntries={["/dashboard"]}>
            <Dashboard />
        </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Monthly sales" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Category breakdown" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Bar chart showing the most common values in region" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Numeric summary statistics for revenue" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Histogram showing the frequency distribution of revenue" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Numeric relationships" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Missing values by column" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Column overview" })).toBeInTheDocument();
    expect(screen.getByText(/3 rows · 2 columns/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Customize dashboard" }));
    fireEvent.change(screen.getByLabelText("Dashboard title"), { target: { value: "Regional sales" } });
    fireEvent.change(screen.getAllByLabelText("Category chart style")[0], { target: { value: "column" } });
    fireEvent.click(screen.getByRole("button", { name: "Save dashboard" }));

    expect(await screen.findByRole("heading", { name: "Regional sales" })).toBeInTheDocument();
    expect(await screen.findByText("Your dashboard changes have been saved.")).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith(
        "/api/dashboard/datasets/5/layout",
        expect.objectContaining({
            method: "PUT",
            body: expect.stringContaining('"distribution_chart":"column"'),
        }),
    );
    fireEvent.change(screen.getByLabelText("Category chart style"), { target: { value: "pie" } });
    expect(await screen.findByRole("img", { name: "Pie chart showing category shares for region" })).toBeInTheDocument();
});

test("generates a dashboard only after the user clicks Generate dashboard", async () => {
    const dataset = {
        id: 12,
        name: "New upload",
        original_filename: "new.csv",
        file_type: "csv",
        file_size: 12,
        status: "uploaded",
        created_at: "2026-11-05T00:00:00Z",
        row_count: null,
        column_count: null,
        missing_cells: null,
        version_number: 1,
        headers: [],
        preview_rows: [],
    };
    const analysis = {
        id: 13,
        dataset_id: 12,
        created_at: "2026-11-05T00:01:00Z",
        quality_issue_count: 0,
        results: {
            row_count: 1,
            column_count: 1,
            missing_cells: 0,
            duplicate_rows: 0,
            columns: [],
            correlations: {},
        },
    };

    apiRequest.mockImplementation(async (path, options = {}) => {
        if (path === "/api/datasets") return [dataset];
        if (path === "/api/reports" || path === "/api/dashboard/exports") return [];
        if (path === "/api/settings") {
            return {
                dashboard_default_dataset_id: 12,
                dashboard_analysis_view: "overview",
                dashboard_time_range: "all",
            };
        }
        if (path.endsWith("/layout")) return {
            title: "New upload",
            visible_widgets: ["value-distribution", "numeric-profile", "missing-values", "column-overview", "insights"],
            category_column: null,
            numeric_column: null,
            distribution_chart: "bar",
        };
        if (path.endsWith("/dashboard")) return dataset;
        if (path.endsWith("/analysis")) {
            return options.method === "POST" ? analysis : null;
        }
        if (path.endsWith("/issues")) return [];
        throw new Error(`Unexpected request: ${path}`);
    });

    render(
        <MemoryRouter initialEntries={["/dashboard"]}>
            <Dashboard />
        </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Your dataset is ready" });
    const generateButtons = await screen.findAllByRole("button", { name: "Generate dashboard" });
    expect(apiRequest.mock.calls.some(([path, options]) => path.endsWith("/analysis") && options?.method === "POST")).toBe(false);
    fireEvent.click(generateButtons[0]);

    expect(apiRequest).toHaveBeenCalledWith(
        "/api/analysis/datasets/12/analysis",
        expect.objectContaining({ method: "POST" }),
    );
    expect(await screen.findByRole("button", { name: "Regenerate dashboard" })).toBeInTheDocument();
});

test("generates one folder dashboard by analyzing every file while keeping file data separate", async () => {
    const datasets = [
        { id: 31, name: "customers.csv", file_type: "csv", file_size: 100, status: "uploaded" },
        { id: 32, name: "orders.csv", file_type: "csv", file_size: 200, status: "uploaded" },
    ];
    const makeAnalysis = (datasetId, category) => ({
        id: datasetId + 100,
        dataset_id: datasetId,
        created_at: "2026-11-05T00:01:00Z",
        quality_issue_count: 0,
        results: {
            row_count: 2,
            column_count: 2,
            missing_cells: 0,
            duplicate_rows: 0,
            columns: [
                {
                    name: "category",
                    inferred_type: "categorical",
                    missing_count: 0,
                    unique_count: 1,
                    statistics: null,
                    histogram: null,
                    top_values: [{ value: category, count: 2 }],
                },
                {
                    name: "amount",
                    inferred_type: "numeric",
                    missing_count: 0,
                    unique_count: 2,
                    statistics: { mean: 15, median: 15, minimum: 10, maximum: 20 },
                    histogram: [{ start: 10, end: 15, count: 1 }, { start: 15, end: 20, count: 1 }],
                    top_values: [{ value: "10", count: 1 }, { value: "20", count: 1 }],
                },
            ],
            correlations: {},
        },
    });

    apiRequest.mockImplementation(async (path, options = {}) => {
        if (path === "/api/datasets") return datasets;
        if (path.endsWith("/analysis")) {
            if (options.method !== "POST") return null;
            const datasetId = Number(path.match(/datasets\/(\d+)\//)[1]);
            return makeAnalysis(datasetId, datasetId === 31 ? "North" : "Paid");
        }
        if (path.endsWith("/issues")) return [];
        throw new Error(`Unexpected request: ${path}`);
    });

    render(
        <MemoryRouter initialEntries={[{
            pathname: "/dashboard",
            search: "?datasets=31,32",
            state: { uploadSummary: "2 files uploaded" },
        }]}>
            <Dashboard />
        </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "customers.csv" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "orders.csv" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Generate dashboard for all 2 files" }));

    expect(await screen.findByText("Dashboard generated for all 2 files.")).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith(
        "/api/analysis/datasets/31/analysis",
        expect.objectContaining({ method: "POST" }),
    );
    expect(apiRequest).toHaveBeenCalledWith(
        "/api/analysis/datasets/32/analysis",
        expect.objectContaining({ method: "POST" }),
    );
    expect(screen.getAllByText("North").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Paid").length).toBeGreaterThan(0);
    expect(screen.getByText(/Charts are generated for each file without mixing unrelated tables/)).toBeInTheDocument();
});
