export const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

function clearInvalidSession() {
    try {
        window.localStorage.removeItem("adp-access-token");
        window.localStorage.removeItem("adp-authenticated");
    } catch {
        // Continue by notifying the app even if browser storage is unavailable.
    }
    window.dispatchEvent(new Event("adp-auth-changed"));
    window.dispatchEvent(new Event("adp-session-expired"));
}

export async function apiRequest(path, options = {}) {
    const { token, headers: requestHeaders, ...requestOptions } = options;
    const headers = new Headers(requestHeaders || {});

    const isFormData = typeof FormData !== "undefined" && requestOptions.body instanceof FormData;
    if (requestOptions.body && !isFormData && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    let response;
    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            ...requestOptions,
            headers,
        });
    } catch (error) {
        if (error instanceof TypeError) {
            throw new Error("Could not connect to the backend. Check that the API server is running.");
        }
        throw error;
    }

    const contentType = response.headers.get("content-type") || "";
    const result = contentType.includes("application/json")
        ? await response.json()
        : {};

    if (!response.ok) {
        const detail = Array.isArray(result.detail)
            ? result.detail.map((item) => item.msg).join(" ")
            : result.detail;
        const requestError = new Error(detail || "The request could not be completed.");
        requestError.status = response.status;
        if (response.status === 401 && token) {
            clearInvalidSession();
        }
        throw requestError;
    }

    return result;
}
