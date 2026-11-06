import { Navigate, useLocation } from "react-router-dom";

const SESSION_KEY = "adp-authenticated";

export function isSignedIn() {
    try {
        return window.sessionStorage.getItem(SESSION_KEY) === "true";
    } catch {
        return false;
    }
}

export function setSignedIn() {
    window.sessionStorage.setItem(SESSION_KEY, "true");
}

function RequireAuth({ children }) {
    const location = useLocation();

    if (!isSignedIn()) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    return children;
}

export default RequireAuth;
