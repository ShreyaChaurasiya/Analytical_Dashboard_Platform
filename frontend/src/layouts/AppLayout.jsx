import { Outlet } from "react-router-dom";
import { useLocation } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import PrimarySidebar from "../components/PrimarySidebar";

function AppLayout() {
    const { pathname } = useLocation();
    const isDashboard = pathname === "/dashboard";
    const isSettings = pathname === "/settings" || pathname === "/dashboard/settings";
    const hasWorkspaceSidebar = isDashboard;

    return (
        <div className={`layout${isDashboard ? " dashboard-layout" : ""}${isSettings ? " settings-layout-page" : ""}`}>
            {!isDashboard && !isSettings && <Header variant="app" />}
            <div className={`site-content-shell${hasWorkspaceSidebar ? " has-workspace-sidebar" : ""}`}>
                {!hasWorkspaceSidebar && (
                    <PrimarySidebar
                        includeSettingsCategories={pathname === "/settings"}
                    />
                )}
                <main id="main-content" className="layout-content"><Outlet /></main>
            </div>
            {!isDashboard && !isSettings && <Footer variant="app" />}
        </div>
    );
}
export default AppLayout;
