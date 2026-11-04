import { Outlet } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import PrimarySidebar from "../components/PrimarySidebar";

function AuthLayout() {
    return (
        <div className="layout auth-layout">
            <Header variant="auth" />
            <div className="site-content-shell">
                <PrimarySidebar includeSettings={false} />
                <main id="main-content" className="layout-content"><Outlet /></main>
            </div>
            <Footer variant="auth" />
        </div>
    );
}
export default AuthLayout;
