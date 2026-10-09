"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type SessionProfile = { fullName: string; email: string; role: string };

export default function PlatformHeader() {
  const [user, setUser] = useState<SessionProfile | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let active = true;
    const density = window.localStorage.getItem("pharmacloud-platform-density");
    if (density === "compact" || density === "comfortable") document.documentElement.dataset.platformDensity = density;
    fetch("/api/auth/session", { cache: "no-store" }).then((response) => response.ok ? response.json() : null)
      .then((payload) => { if (active) setUser(payload?.data ?? null); })
      .catch(() => { if (active) setUser(null); });
    return () => { active = false; };
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get("query");
    if (query) setSearch(query);
  }, [pathname]);
  useEffect(() => {
    function closeOutside(event: MouseEvent) {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, []);

  async function logout() {
    setLoggingOut(true);
    try { await fetch("/api/auth/logout", { method: "POST" }); }
    finally { router.replace("/login"); router.refresh(); }
  }

  const initials = (user?.fullName || "Super Admin").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!search.trim()) return;
    router.push(`/platform-users?query=${encodeURIComponent(search.trim())}`);
    setSearchOpen(false);
  }

  return <header className="platform-topbar">
    <div className="platform-topbar-brand"><span className="platform-topbar-caption">PHARMACLOUD <i>/</i> PLATFORM</span><strong>Super-admin console</strong></div>
    <div className="platform-header-actions">
      <form className="platform-global-search" role="search" onSubmit={submitSearch}><span aria-hidden="true">⌕</span><input aria-label="Search pharmacies and users" placeholder="Search pharmacies, users…" value={search} onFocus={() => setSearchOpen(true)} onChange={(event) => setSearch(event.target.value)} /><kbd>⌘ K</kbd>{searchOpen && search.trim() && <div className="platform-search-popover"><strong>Search platform users & pharmacies</strong><p>Press Enter to search names, emails, roles and pharmacy workspaces.</p><button type="submit">Search “{search.trim()}” →</button></div>}</form>
      <span className="platform-health-indicator"><i /> Super Admin session</span>
      <Link href="/notifications" className={`platform-header-icon${pathname === "/notifications" ? " is-current" : ""}`} aria-label="Notifications" title="Notifications"><span aria-hidden="true">♧</span></Link>
      <Link href="/settings" className={`platform-header-icon${pathname === "/settings" ? " is-current" : ""}`} aria-label="Settings" title="Settings"><span aria-hidden="true">⚙</span></Link>
      <div className="platform-account-menu" ref={menuRef}>
        <button type="button" className={`platform-account-trigger${menuOpen ? " is-open" : ""}`} aria-expanded={menuOpen} aria-haspopup="menu" onClick={() => setMenuOpen((open) => !open)}>
          <span className="platform-account-avatar">{initials}</span>
          <span className="platform-account-copy"><strong>{user?.fullName || "Super Admin"}</strong><small>{user?.role === "SUPER_ADMIN" ? "Platform administrator" : user?.email || "Account"}</small></span>
          <span className="platform-account-chevron" aria-hidden="true">⌄</span>
        </button>
        {menuOpen && <div className="platform-account-dropdown" role="menu">
          <div className="platform-dropdown-profile"><span className="platform-account-avatar">{initials}</span><span><strong>{user?.fullName || "Super Admin"}</strong><small>{user?.email || ""}</small></span></div>
          <Link role="menuitem" href="/profile"><span aria-hidden="true">♙</span> My profile</Link>
          <Link role="menuitem" href="/settings"><span aria-hidden="true">⚙</span> Platform settings</Link>
          <button role="menuitem" type="button" onClick={() => void logout()} disabled={loggingOut}><span aria-hidden="true">↪</span>{loggingOut ? "Signing out…" : "Log out"}</button>
        </div>}
      </div>
    </div>
  </header>;
}
