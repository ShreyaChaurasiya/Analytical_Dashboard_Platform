import { apiRequest } from "./client";

test("clears an invalid access token and notifies the app after an authenticated 401", async () => {
    window.localStorage.setItem("adp-access-token", "expired-token");
    window.localStorage.setItem("adp-authenticated", "true");
    const authChanged = jest.fn();
    window.addEventListener("adp-auth-changed", authChanged);
    global.fetch = jest.fn(async () => ({
        ok: false,
        status: 401,
        headers: { get: () => "application/json" },
        json: async () => ({ detail: "Authentication is required or the access token is invalid." }),
    }));

    await expect(apiRequest("/api/datasets", { token: "expired-token" }))
        .rejects.toMatchObject({ status: 401 });

    expect(window.localStorage.getItem("adp-access-token")).toBeNull();
    expect(window.localStorage.getItem("adp-authenticated")).toBeNull();
    expect(authChanged).toHaveBeenCalledTimes(1);
    window.removeEventListener("adp-auth-changed", authChanged);
});
