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
import About from "./pages/About";
import Help from "./pages/Help";
import "./App.css";

function isAuthenticated() {
  try {
    return Boolean(window.localStorage.getItem("adp-access-token"));
  } catch {
    return false;
  }
}

function ProtectedRoute({ children }) {
  return isAuthenticated() ? children : <Navigate to="/login" replace />;
}

function PublicOnlyRoute({ children }) {
  return isAuthenticated() ? <Navigate to="/" replace /> : children;
}

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="/help" element={<ProtectedRoute><Help /></ProtectedRoute>} />
        <Route path="/about" element={<ProtectedRoute><About /></ProtectedRoute>} />
      </Route>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
        <Route path="/login/otp" element={<LoginOtp />} />
        <Route path="/forget-password" element={<ForgetPassword />} />
        <Route path="/reset-password" element={<ProtectedRoute><ResetPassword /></ProtectedRoute>} />
        <Route path="/register" element={<PublicOnlyRoute><Registration /></PublicOnlyRoute>} />
        <Route path="/registration" element={<PublicOnlyRoute><Registration /></PublicOnlyRoute>} />
      </Route>
      <Route path="*" element={<Navigate to={isAuthenticated() ? "/" : "/registration"} replace />} />
    </Routes>
  );
}

export default App;
