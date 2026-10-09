"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BranchSwitcher from "@/components/layout/BranchSwitcher";

/** Shows active branch, signed-in user, and a logout action. */
export default function Topbar() {
  const [user, setUser] = useState<{ fullName: string; email: string } | null>(null);
  const router = useRouter();
  useEffect(() => { fetch("/api/auth/session").then((r) => r.ok ? r.json() : null).then((p) => setUser(p?.data ?? null)).catch(() => setUser(null)); }, []);
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.replace("/login"); router.refresh(); }
  return <header className="ph-topbar"><div className="ph-topbar-left"><span className="ph-topbar-title">PharmaCloud <small>MANAGEMENT</small></span><BranchSwitcher /></div><div className="ph-topbar-user"><span className="ph-user-avatar">{(user?.fullName || "A").slice(0, 1).toUpperCase()}</span><span className="ph-user-copy"><strong>{user?.fullName || "Account"}</strong><small>{user?.email || ""}</small></span><button onClick={() => void logout()} className="ph-logout">Ka bax</button></div></header>;
}
