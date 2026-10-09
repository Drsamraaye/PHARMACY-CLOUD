import Link from "next/link";
import PlatformHeader from "@/components/super-admin/PlatformHeader";
import PlatformNavigation from "@/components/super-admin/PlatformNavigation";

/** Shared, role-protected navigation shell for the platform owner's dashboard. */
export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="platform-shell">
      <aside className="platform-sidebar">
        <Link href="/platform-analytics" className="platform-brand"><span className="platform-brand-mark">✚</span><span>Pharma<span>Cloud</span><small>PLATFORM CONSOLE</small></span></Link>
        <p className="platform-nav-label">WORKSPACE</p>
        <PlatformNavigation />
        <div className="platform-sidebar-footer"><span className="platform-online-dot" /> Platform controls <span>Secure</span></div>
      </aside>
      <div className="platform-main">
        <PlatformHeader />
        <main className="platform-content">{children}</main>
      </div>
    </div>
  );
}
