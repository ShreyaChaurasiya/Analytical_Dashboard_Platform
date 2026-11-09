import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import AuthLayout from "./layouts/AuthLayout";
import Login from "./pages/Login";
import LoginOtp from "./pages/LoginOtp";
import ForgetPassword from "./pages/ForgetPassword";
import ResetPassword from "./pages/ResetPassword";
import Registration from "./pages/Registration";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/Upload";
import Reports from "./pages/Reports";
import Datasets from "./pages/Datasets";
import Datasetdetails from "./pages/Datasetdetails";
import Quality from "./pages/Quality";
import About from "./pages/About";
import Help from "./pages/Help";
import Settings from "./pages/Settings";
import "./App.css";

function isAuthenticated() {
  try {
    return Boolean(window.localStorage.getItem("adp-access-token"));
  } catch {
    return false;
  }
}

function ProtectedRoute({ children }) {
  const [authenticated, setAuthenticated] = useState(isAuthenticated);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    const handleSessionExpired = () => {
      const hasToken = isAuthenticated();
      setAuthenticated(hasToken);
      setSessionExpired(!hasToken);
    };
    window.addEventListener("adp-session-expired", handleSessionExpired);
    window.addEventListener("storage", handleSessionExpired);
    return () => {
      window.removeEventListener("adp-session-expired", handleSessionExpired);
      window.removeEventListener("storage", handleSessionExpired);
    };
  }, []);

  return authenticated
    ? children
    : <Navigate to="/login" replace state={sessionExpired ? { sessionExpired: true } : undefined} />;
}

function PublicOnlyRoute({ children }) {
  return isAuthenticated() ? <Navigate to="/dashboard" replace /> : children;
}

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="/datasets" element={<ProtectedRoute><Datasets /></ProtectedRoute>} />
        <Route path="/datasets/:datasetId" element={<ProtectedRoute><Datasetdetails /></ProtectedRoute>} />
        <Route path="/quality" element={<ProtectedRoute><Quality /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/dashboard/settings" element={<ProtectedRoute><Settings scope="dashboard" /></ProtectedRoute>} />
        <Route path="/help" element={<Help />} />
        <Route path="/about" element={<About />} />
      </Route>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
        <Route path="/login/otp" element={<LoginOtp />} />
        <Route path="/forget-password" element={<ForgetPassword />} />
        <Route path="/reset-password" element={<ProtectedRoute><ResetPassword /></ProtectedRoute>} />
        <Route path="/register" element={<PublicOnlyRoute><Registration /></PublicOnlyRoute>} />
        <Route path="/registration" element={<PublicOnlyRoute><Registration /></PublicOnlyRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
