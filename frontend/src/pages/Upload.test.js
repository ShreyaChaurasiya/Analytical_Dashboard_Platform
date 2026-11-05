import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { apiRequest } from "../api/client";
import Upload from "./Upload";

jest.mock("../api/client", () => ({
    apiRequest: jest.fn(),
}));

function DashboardDestination() {
    const location = useLocation();
    return <><p>{location.state.uploadSummary}</p><p>{location.state.datasetIds.join(",")}</p></>;
}

test("uploads each selected file without analyzing or creating reports", async () => {
    let datasetId = 0;
    apiRequest.mockImplementation(async (path) => {
        if (path === "/api/datasets/upload") return { id: ++datasetId };
        throw new Error(`Unexpected request: ${path}`);
    });

    render(
        <MemoryRouter initialEntries={["/upload"]}>
            <Routes>
                <Route path="/upload" element={<Upload />} />
                <Route path="/dashboard" element={<DashboardDestination />} />
            </Routes>
        </MemoryRouter>,
    );

    const fileInput = screen.getByLabelText(/Select multiple data files/);
    expect(screen.getByLabelText(/Select a folder/)).toHaveAttribute("webkitdirectory");
    expect(fileInput).toHaveAttribute("multiple");
    const firstFile = new File(["name\nfirst"], "first.csv", { type: "text/csv" });
    const secondFile = new File(["x".repeat(10 * 1024 * 1024 + 1)], "second.csv", { type: "text/csv" });
    fireEvent.change(fileInput, { target: { files: [firstFile, secondFile] } });

    fireEvent.click(await screen.findByRole("button", { name: "Upload 2 datasets" }));

    expect(await screen.findByText(/Generate one folder dashboard to analyze all uploaded files together/)).toBeInTheDocument();
    expect(screen.getByText("1,2")).toBeInTheDocument();
    await waitFor(() => {
        expect(apiRequest.mock.calls.filter(([path]) => path === "/api/datasets/upload")).toHaveLength(2);
    });
    expect(apiRequest.mock.calls.some(([path]) => path === "/api/datasets/preview")).toBe(false);
    expect(apiRequest.mock.calls.some(([path]) => path.includes("/analysis"))).toBe(false);
    expect(apiRequest.mock.calls.some(([path]) => path.includes("/reports"))).toBe(false);
});
