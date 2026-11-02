export const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

export async function apiRequest(path, options = {}) {
    const { token, headers: requestHeaders, ...requestOptions } = options;
    const headers = new Headers(requestHeaders || {});

    if (requestOptions.body && !headers.has("Content-Type")) {
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
        throw new Error(detail || "The request could not be completed.");
    }

    return result;
}
