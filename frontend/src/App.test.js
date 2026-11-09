import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";

test("shows the public landing page to visitors who are not signed in", () => {
  window.localStorage.clear();
  render(
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>,
  );

  expect(screen.getByRole("heading", { name: /Make your data make sense/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/register");
});

test("redirects unauthenticated dashboard visitors to login", () => {
  window.localStorage.clear();
  render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <App />
    </MemoryRouter>,
  );

  expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
});

test.each([
  ["/about", "Make analysis easier to understand."],
  ["/help", "Move from a file to a clear finding."],
])("allows visitors to open the public %s page without signing in", (path, heading) => {
  window.localStorage.clear();
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

  expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Log in" })).not.toBeInTheDocument();
});

test("redirects to login when the active access token becomes invalid", async () => {
  window.localStorage.setItem("adp-access-token", "expired-token");
  render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <App />
    </MemoryRouter>,
  );

  act(() => {
    window.localStorage.removeItem("adp-access-token");
    window.dispatchEvent(new Event("adp-session-expired"));
  });

  expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
  expect(screen.getByText("Your session expired or is no longer valid. Please sign in again.")).toBeInTheDocument();
});

test("saves main settings to the signed-in account", async () => {
  const preferences = {
    full_name: "Test User",
    email: "test@example.com",
    username: "test-user",
    phone: "555-0100",
    account_type: "individual",
    organization: "Example Office",
    job_title: "Analyst",
    account_status: "approved",
    account_created_at: "2025-01-15T00:00:00Z",
    theme: "light",
    text_size: "default",
    contrast_mode: "standard",
    reduce_motion: false,
    default_landing_page: "home",
    home_featured_sample: "rainfall",
    dashboard_default_dataset_id: null,
    dashboard_analysis_view: "overview",
    dashboard_time_range: "all",
    dashboard_report_format: "pdf",
  };
  window.localStorage.setItem("adp-access-token", "test-token");
  global.fetch = jest.fn(async (_url, options = {}) => {
    if (_url.endsWith("/api/datasets")) {
      return {
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => [],
      };
    }
    if (options.method === "PATCH") Object.assign(preferences, JSON.parse(options.body));
    return {
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => preferences,
    };
  });

  render(
    <MemoryRouter initialEntries={["/settings"]}>
      <App />
    </MemoryRouter>,
  );

  expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "← Back to dashboard" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
  const settingsNavigation = screen.getByRole("navigation", { name: "Main navigation" });
  ["Home", "Dashboard", "About", "Help", "Settings"].forEach((label) => {
    expect(within(settingsNavigation).getByRole("link", { name: label })).toBeInTheDocument();
  });
  const categoryNavigation = screen.getByRole("navigation", { name: "Settings categories" });
  ["Account", "Security", "Privacy & data", "Display & accessibility", "Home preferences"].forEach((label) => {
    expect(within(categoryNavigation).getByRole("link", { name: label })).toBeInTheDocument();
  });
  expect(screen.queryByRole("button", { name: "Download my account data" })).not.toBeInTheDocument();
  expect(screen.queryByText("Included in the export")).not.toBeInTheDocument();
  expect(await screen.findByLabelText("Full name")).toHaveValue("Test User");
  expect(screen.getByLabelText("Organization")).toHaveValue("Example Office");
  expect(screen.getAllByRole("link", { name: "Dashboard settings" })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Hide workspace" }));
  expect(screen.getByRole("button", { name: "Show workspace" })).toBeInTheDocument();
  expect(document.querySelector(".site-primary-sidebar")).toHaveAttribute("aria-hidden", "true");
  fireEvent.click(screen.getByRole("button", { name: "Show workspace" }));
  expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeInTheDocument();
  expect(screen.getByRole("navigation", { name: "Settings categories" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Security" })).toBeInTheDocument();
  expect(screen.getByText("A one-time code is required when you sign in.")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "555-0199" } });
  fireEvent.click(screen.getByRole("button", { name: "Save account details" }));
  expect(await screen.findByText("Your account details have been saved.")).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining("/api/settings/profile"),
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({
        full_name: "Test User",
        phone: "555-0199",
        organization: "Example Office",
        job_title: "Analyst",
      }),
    }),
  );
  fireEvent.change(screen.getByLabelText("Color theme"), { target: { value: "dark" } });
  fireEvent.change(screen.getByLabelText("Contrast"), { target: { value: "high" } });
  fireEvent.click(screen.getByLabelText(/Reduce motion/));
  fireEvent.change(screen.getByLabelText("After sign-in, open"), { target: { value: "dashboard" } });
  fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

  expect(await screen.findByText("Your settings have been saved to your account.")).toBeInTheDocument();
  await waitFor(() => {
    expect(document.documentElement.dataset.adpContrast).toBe("high");
    expect(document.documentElement.dataset.adpReduceMotion).toBe("true");
  });

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/settings"),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          theme: "dark",
          text_size: "default",
          contrast_mode: "high",
          reduce_motion: true,
          default_landing_page: "dashboard",
          home_featured_sample: "rainfall",
        }),
      }),
    );
  });
  window.localStorage.clear();
});

test("signs out the current browser from Security settings", async () => {
  window.localStorage.setItem("adp-access-token", "test-token");
  global.fetch = jest.fn(async (url) => ({
    ok: true,
    headers: { get: () => "application/json" },
    json: async () => url.endsWith("/api/datasets") ? [] : ({
      full_name: "Test User",
      email: "test@example.com",
      account_status: "approved",
      theme: "light",
      text_size: "default",
      contrast_mode: "standard",
      reduce_motion: false,
      default_landing_page: "home",
      home_featured_sample: "rainfall",
    }),
  }));
  render(
    <MemoryRouter initialEntries={["/settings"]}>
      <App />
    </MemoryRouter>,
  );

  fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));
  expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
  expect(window.localStorage.getItem("adp-access-token")).toBeNull();
});

test("requires confirmation before removing a dataset from Privacy settings", async () => {
  const preferences = {
    full_name: "Test User",
    email: "test@example.com",
    account_status: "approved",
    theme: "light",
    text_size: "default",
    contrast_mode: "standard",
    reduce_motion: false,
    default_landing_page: "home",
    home_featured_sample: "rainfall",
  };
  const fetchMock = jest.fn(async (url, options = {}) => {
    if (url.includes("/api/datasets")) {
      if (options.method === "DELETE") {
        return { ok: true, headers: { get: () => null } };
      }
      return {
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => [{ id: 25, name: "Sensitive records", file_type: "csv", original_filename: "records.csv" }],
      };
    }
    return {
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => preferences,
    };
  });
  window.localStorage.setItem("adp-access-token", "test-token");
  global.fetch = fetchMock;
  render(
    <MemoryRouter initialEntries={["/settings"]}>
      <App />
    </MemoryRouter>,
  );

  fireEvent.click(await screen.findByRole("button", { name: "Remove dataset" }));
  expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Permanently delete" }));
  expect(await screen.findByText(/Dataset “Sensitive records” and its associated analysis and reports were deleted/)).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining("/api/datasets/25"),
    expect.objectContaining({ method: "DELETE" }),
  );
  window.localStorage.clear();
});

test("updates the sign-in email only after verification of the new address", async () => {
  const settings = {
    full_name: "Test User",
    email: "old@example.com",
    account_status: "approved",
    theme: "light",
    text_size: "default",
    contrast_mode: "standard",
    reduce_motion: false,
    default_landing_page: "home",
    home_featured_sample: "rainfall",
  };
  const fetchMock = jest.fn(async (url, options = {}) => {
    if (url.includes("/api/datasets")) {
      return { ok: true, headers: { get: () => "application/json" }, json: async () => [] };
    }
    if (url.endsWith("/api/settings/email-change")) {
      return {
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({
          challenge_id: "email-change-challenge-123456789",
          masked_email: "n***@example.com",
          message: "A verification code was sent to your new email address.",
        }),
      };
    }
    if (url.endsWith("/api/settings/email-change/verify")) {
      Object.assign(settings, { email: "new@example.com" });
      return {
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({
          email: "new@example.com",
          message: "Email updated. A security notice was sent to your previous address.",
          notification_sent: true,
        }),
      };
    }
    return {
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => settings,
    };
  });
  window.localStorage.setItem("adp-access-token", "test-token");
  global.fetch = fetchMock;
  render(
    <MemoryRouter initialEntries={["/settings"]}>
      <App />
    </MemoryRouter>,
  );

  fireEvent.change(await screen.findByLabelText("New email address"), { target: { value: "new@example.com" } });
  fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "ValidPassword1!" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify new email" }));
  expect(await screen.findByText(/code sent to n\*\*\*@example.com/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Email verification code"), { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm email change" }));
  expect(await screen.findByText(/Email updated/)).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining("/api/settings/email-change/verify"),
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ challenge_id: "email-change-challenge-123456789", code: "123456" }),
    }),
  );
  window.localStorage.clear();
});

test("deletes the account after password and name confirmation and displays a notice", async () => {
  const preferences = {
    full_name: "Test User",
    email: "test@example.com",
    account_status: "approved",
    theme: "light",
    text_size: "default",
    contrast_mode: "standard",
    reduce_motion: false,
    default_landing_page: "home",
    home_featured_sample: "rainfall",
  };
  const fetchMock = jest.fn(async (url, options = {}) => {
    if (url.includes("/api/datasets")) {
      return { ok: true, headers: { get: () => "application/json" }, json: async () => [] };
    }
    if (url.endsWith("/api/settings/account")) {
      return {
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({
          message: "Account deleted.",
          notification_sent: true,
          storage_cleanup_complete: true,
        }),
      };
    }
    return { ok: true, headers: { get: () => "application/json" }, json: async () => preferences };
  });
  window.localStorage.setItem("adp-access-token", "test-token");
  global.fetch = fetchMock;
  render(
    <MemoryRouter initialEntries={["/settings"]}>
      <App />
    </MemoryRouter>,
  );

  fireEvent.click(await screen.findByRole("button", { name: "Delete my account" }));
  const passwordFields = screen.getAllByLabelText("Current password");
  fireEvent.change(passwordFields[passwordFields.length - 1], { target: { value: "ValidPassword1!" } });
  fireEvent.change(screen.getByLabelText(/Type your account name/), { target: { value: "Test User" } });
  fireEvent.click(screen.getByRole("button", { name: "Permanently delete account" }));
  expect(await screen.findByRole("status")).toHaveTextContent(/Account deleted/);
  expect(window.localStorage.getItem("adp-access-token")).toBeNull();
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining("/api/settings/account"),
    expect.objectContaining({
      method: "DELETE",
      body: JSON.stringify({ current_password: "ValidPassword1!", confirmation_name: "Test User" }),
    }),
  );
  window.localStorage.clear();
});

test("cancels account deletion without sending a delete request", async () => {
  const fetchMock = jest.fn(async (url) => ({
    ok: true,
    headers: { get: () => "application/json" },
    json: async () => url.includes("/api/datasets") ? [] : ({
      full_name: "Test User",
      email: "test@example.com",
      account_status: "approved",
      theme: "light",
      text_size: "default",
      contrast_mode: "standard",
      reduce_motion: false,
      default_landing_page: "home",
      home_featured_sample: "rainfall",
    }),
  }));
  window.localStorage.setItem("adp-access-token", "test-token");
  global.fetch = fetchMock;
  render(
    <MemoryRouter initialEntries={["/settings"]}>
      <App />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Delete my account" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel deletion" }));
  expect(await screen.findByText("Account deletion cancelled. Your account and data are unchanged.")).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalledWith(
    expect.stringContaining("/api/settings/account"),
    expect.objectContaining({ method: "DELETE" }),
  );
  window.localStorage.clear();
});

test("deletes a generated report from the Reports page", async () => {
  const report = {
    id: 41,
    dataset_id: 8,
    dataset_name: "Monthly data",
    format: "pdf",
    created_at: "2025-01-15T00:00:00Z",
  };
  const fetchMock = jest.fn(async (url, options = {}) => {
    if (url.endsWith("/api/datasets")) {
      return { ok: true, headers: { get: () => "application/json" }, json: async () => [{ id: 8, name: "Monthly data" }] };
    }
    if (url.endsWith("/api/reports")) {
      return { ok: true, headers: { get: () => "application/json" }, json: async () => [report] };
    }
    if (url.includes("/api/reports/reports/41") && options.method === "DELETE") {
      return { ok: true, headers: { get: () => null } };
    }
    return {
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ dashboard_report_format: "pdf" }),
    };
  });
  window.localStorage.setItem("adp-access-token", "test-token");
  global.fetch = fetchMock;
  render(
    <MemoryRouter initialEntries={["/reports"]}>
      <App />
    </MemoryRouter>,
  );

  fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete", exact: true }));
  expect(await screen.findByText(/The report and its stored server copy were deleted/)).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining("/api/reports/reports/41"),
    expect.objectContaining({ method: "DELETE" }),
  );
  window.localStorage.clear();
});

test("saves dashboard defaults separately from main settings", async () => {
  const preferences = {
    full_name: "Test User",
    email: "test@example.com",
    theme: "light",
    text_size: "default",
    contrast_mode: "standard",
    reduce_motion: false,
    default_landing_page: "home",
    home_featured_sample: "rainfall",
    dashboard_default_dataset_id: null,
    dashboard_analysis_view: "overview",
    dashboard_time_range: "all",
    dashboard_report_format: "pdf",
  };
  const fetchMock = jest.fn(async (url, options = {}) => {
    if (url.includes("/api/datasets")) {
      return {
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => [{ id: 12, name: "Monthly data" }],
      };
    }
    if (options.method === "PATCH") Object.assign(preferences, JSON.parse(options.body));
    return {
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => preferences,
    };
  });
  window.localStorage.setItem("adp-access-token", "test-token");
  global.fetch = fetchMock;

  render(
    <MemoryRouter initialEntries={["/dashboard/settings"]}>
      <App />
    </MemoryRouter>,
  );

  expect(await screen.findByRole("heading", { name: "Dashboard settings" })).toBeInTheDocument();
  expect(await screen.findByRole("option", { name: "Monthly data" })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Opening analysis view"), { target: { value: "summary" } });
  fireEvent.change(screen.getByLabelText("Preferred report format"), { target: { value: "xlsx" } });
  fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

  expect(await screen.findByText("Your settings have been saved to your account.")).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining("/api/settings"),
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({
        dashboard_default_dataset_id: null,
        dashboard_analysis_view: "summary",
        dashboard_time_range: "all",
        dashboard_report_format: "xlsx",
      }),
    }),
  );
  window.localStorage.clear();
});

test("uses the saved Home example and exposes main settings from Home", async () => {
  const preferences = {
    full_name: "Test User",
    email: "test@example.com",
    theme: "light",
    text_size: "default",
    contrast_mode: "standard",
    reduce_motion: false,
    default_landing_page: "home",
    home_featured_sample: "cpi",
    dashboard_default_dataset_id: null,
    dashboard_analysis_view: "overview",
    dashboard_time_range: "all",
    dashboard_report_format: "pdf",
  };
  window.localStorage.setItem("adp-access-token", "test-token");
  global.fetch = jest.fn(async () => ({
    ok: true,
    headers: { get: () => "application/json" },
    json: async () => preferences,
  }));

  render(
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>,
  );

  expect(await screen.findByText("Data example · Consumer prices")).toBeInTheDocument();
  const mainNavigation = screen.getByRole("navigation", { name: "Main navigation" });
  ["Home", "Dashboard", "About", "Help", "Settings"].forEach((label) => {
    expect(within(mainNavigation).getByRole("link", { name: label })).toBeInTheDocument();
  });
  const header = screen.getByRole("banner");
  ["Dashboard", "About", "Help", "Settings"].forEach((label) => {
    expect(within(header).queryByRole("link", { name: label })).not.toBeInTheDocument();
  });
  window.localStorage.clear();
});

test("applies saved dashboard defaults when the dashboard opens", async () => {
  const dataset = {
    id: 12,
    name: "Monthly data",
    original_filename: "monthly.csv",
    file_type: "csv",
    file_size: 20,
    status: "uploaded",
    created_at: new Date().toISOString(),
    row_count: 1,
    column_count: 2,
    missing_cells: 0,
    version_number: 1,
    headers: ["month", "value"],
    preview_rows: [["Jan", 10]],
  };
  const preferences = {
    full_name: "Test User",
    email: "test@example.com",
    theme: "light",
    text_size: "default",
    contrast_mode: "standard",
    reduce_motion: false,
    default_landing_page: "home",
    home_featured_sample: "rainfall",
    dashboard_default_dataset_id: 12,
    dashboard_analysis_view: "summary",
    dashboard_time_range: "7",
    dashboard_report_format: "xlsx",
  };
  window.localStorage.setItem("adp-access-token", "test-token");
  global.fetch = jest.fn(async (url) => {
    let response = preferences;
    if (url.endsWith("/api/datasets")) response = [dataset];
    if (url.endsWith("/api/reports")) response = [];
    if (url.endsWith("/api/dashboard/exports")) response = [];
    if (url.endsWith("/dashboard")) response = dataset;
    if (url.endsWith("/analysis")) response = null;
    return {
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => response,
    };
  });

  render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <App />
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(screen.getByLabelText("Analysis view")).toHaveValue("summary");
    expect(screen.getByLabelText("Time range")).toHaveValue("7");
    expect(screen.getByLabelText("Dataset")).toHaveValue("12");
  });
  const dashboardNavigation = screen.getByRole("complementary", { name: "Dashboard sections" });
  ["Home", "Dashboard", "Help centre", "Settings"].forEach((label) => {
    expect(within(dashboardNavigation).getByRole("link", { name: label })).toBeInTheDocument();
  });
  expect(within(dashboardNavigation).queryByRole("link", { name: "About" })).not.toBeInTheDocument();
  window.localStorage.clear();
});

test("downloads a dashboard summary and keeps a server copy", async () => {
  const savedExport = {
    id: 17,
    file_name: "adp-dashboard-summary-20261104-120000.csv",
    created_at: "2026-11-04T12:00:00Z",
  };
  const fetchMock = jest.fn(async (url, options = {}) => {
    if (url.endsWith("/api/dashboard/exports/summary") && options.method === "POST") {
      return { ok: true, headers: { get: () => "application/json" }, json: async () => savedExport };
    }
    if (url.endsWith("/api/dashboard/exports/17/download")) {
      return {
        ok: true,
        headers: { get: () => "text/csv" },
        blob: async () => new Blob(["item,value"]),
      };
    }
    let response = {
      full_name: "Test User",
      email: "test@example.com",
      dashboard_default_dataset_id: null,
      dashboard_analysis_view: "overview",
      dashboard_time_range: "all",
      dashboard_report_format: "pdf",
    };
    if (url.endsWith("/api/datasets") || url.endsWith("/api/reports") || url.endsWith("/api/dashboard/exports")) {
      response = [];
    }
    return { ok: true, headers: { get: () => "application/json" }, json: async () => response };
  });
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  URL.createObjectURL = jest.fn(() => "blob:dashboard-summary");
  URL.revokeObjectURL = jest.fn();
  const clickLink = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  window.localStorage.setItem("adp-access-token", "test-token");
  global.fetch = fetchMock;
  render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <App />
    </MemoryRouter>,
  );

  fireEvent.click(await screen.findByRole("button", { name: "Downloads" }));
  fireEvent.click(screen.getByRole("button", { name: "Download summary CSV" }));
  expect(await screen.findByRole("status")).toHaveTextContent(/saved in Dashboard downloads/);
  expect(screen.getByRole("button", { name: savedExport.file_name })).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining("/api/dashboard/exports/summary"),
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ dataset_id: null, time_range: "all" }),
    }),
  );
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining("/api/dashboard/exports/17/download"),
    expect.objectContaining({ headers: expect.any(Object) }),
  );
  expect(clickLink).toHaveBeenCalled();

  clickLink.mockRestore();
  URL.createObjectURL = originalCreateObjectURL || jest.fn(() => "blob:dashboard-summary");
  URL.revokeObjectURL = originalRevokeObjectURL || jest.fn();
  window.localStorage.clear();
});

test("lists datasets and opens a dataset details page", async () => {
  const dataset = {
    id: 5,
    name: "Monthly data",
    original_filename: "monthly.csv",
    file_type: "csv",
    file_size: 2048,
    status: "uploaded",
    created_at: "2026-11-04T12:00:00Z",
    row_count: 2,
    column_count: 2,
    missing_cells: 0,
    version_number: 1,
    headers: ["month", "amount"],
    preview_rows: [["Jan", "12"], ["Feb", "15"]],
  };
  const fetchMock = jest.fn(async (url, options = {}) => {
    if (url.endsWith("/api/datasets")) {
      return { ok: true, headers: { get: () => "application/json" }, json: async () => [dataset] };
    }
    if (url.endsWith("/api/datasets/5")) {
      return { ok: true, headers: { get: () => "application/json" }, json: async () => dataset };
    }
    if (url.endsWith("/api/analysis/datasets/5/analysis") && options.method === "POST") {
      return {
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({ id: 12, created_at: "2026-11-04T12:30:00Z", quality_issue_count: 1, results: { row_count: 2 } }),
      };
    }
    return { ok: true, headers: { get: () => "application/json" }, json: async () => null };
  });
  window.localStorage.setItem("adp-access-token", "test-token");
  global.fetch = fetchMock;
  render(
    <MemoryRouter initialEntries={["/datasets"]}>
      <App />
    </MemoryRouter>,
  );

  expect(await screen.findByRole("heading", { name: "Your datasets" })).toBeInTheDocument();
  fireEvent.click(await screen.findByRole("link", { name: "Open dataset" }));
  expect(await screen.findByRole("heading", { name: "Monthly data" })).toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: "month" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Run analysis" }));
  expect(await screen.findByText(/Analysis complete/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Review quality findings" })).toHaveAttribute("href", "/quality?dataset=5");
  window.localStorage.clear();
});

test("runs and displays quality findings for the selected dataset", async () => {
  const dataset = {
    id: 5,
    name: "Monthly data",
    original_filename: "monthly.csv",
    row_count: 2,
  };
  const issue = {
    id: 22,
    dataset_id: 5,
    analysis_id: 12,
    issue_type: "missing_values",
    column_name: "amount",
    severity: "medium",
    affected_rows: 1,
    description: "1 of 2 rows have a missing value.",
    details: { missing_count: 1, percentage: 50 },
    created_at: "2026-11-04T12:30:00Z",
  };
  const fetchMock = jest.fn(async (url, options = {}) => {
    if (url.endsWith("/api/datasets")) {
      return { ok: true, headers: { get: () => "application/json" }, json: async () => [dataset] };
    }
    if (url.endsWith("/api/analysis/datasets/5/analysis") && options.method === "POST") {
      return {
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({ id: 12, created_at: "2026-11-04T12:30:00Z", quality_issue_count: 1 }),
      };
    }
    if (url.endsWith("/api/analysis/datasets/5/analysis")) {
      return { ok: true, headers: { get: () => "application/json" }, json: async () => null };
    }
    if (url.endsWith("/api/quality/datasets/5/issues") && fetchMock.mock.calls.some(([, request]) => request?.method === "POST")) {
      return { ok: true, headers: { get: () => "application/json" }, json: async () => [issue] };
    }
    return {
      ok: false,
      headers: { get: () => "application/json" },
      json: async () => ({ detail: "Run an analysis before requesting data-quality findings." }),
    };
  });
  window.localStorage.setItem("adp-access-token", "test-token");
  global.fetch = fetchMock;
  render(
    <MemoryRouter initialEntries={["/quality"]}>
      <App />
    </MemoryRouter>,
  );

  expect(await screen.findByRole("heading", { name: "No quality analysis yet" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Run quality checks" }));
  expect(await screen.findByText("1 of 2 rows have a missing value.")).toBeInTheDocument();
  expect(screen.getByText("medium")).toBeInTheDocument();
  expect(screen.getByText("Column: amount · 1 affected row")).toBeInTheDocument();
  window.localStorage.clear();
});

test("opens the selected post-login page", async () => {
  const preferences = {
    full_name: "Test User",
    email: "test@example.com",
    default_landing_page: "dashboard",
  };
  window.localStorage.clear();
  global.fetch = jest.fn(async (url) => {
    let response = preferences;
    if (url.includes("/api/auth/login/verify-otp")) {
      response = {
        access_token: "new-test-token",
        password_reset_required: false,
      };
    } else if (url.endsWith("/api/datasets")) {
      response = [];
    } else if (url.endsWith("/api/reports")) {
      response = [];
    } else if (url.endsWith("/api/dashboard/exports")) {
      response = [];
    }
    return {
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => response,
    };
  });

  render(
    <MemoryRouter initialEntries={[{
      pathname: "/login/otp",
      state: { challengeId: "test-challenge-id-123456", email: "test@example.com" },
    }]}>
      <App />
    </MemoryRouter>,
  );

  fireEvent.change(screen.getByLabelText("Email verification code"), { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify" }));
  expect(await screen.findByRole("heading", { name: "Start with your data" })).toBeInTheDocument();
  window.localStorage.clear();
});
