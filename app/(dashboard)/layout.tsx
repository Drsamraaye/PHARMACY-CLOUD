import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";

/** Wraps authenticated application pages with the shared navigation shell. */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ph-app-shell">
      <Sidebar />
      <div className="ph-app-main">
        <Topbar />
        <main className="ph-main-content">{children}</main>
      </div>
    </div>
  );
}
