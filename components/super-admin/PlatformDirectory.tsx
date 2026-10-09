"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type TenantOption = { id: string; name: string };
type UserRow = { id: string; tenantId: string; fullName: string; email: string; role: string; isActive: boolean; createdAt: string; tenant: { name: string; slug: string; isActive: boolean }; branch: { name: string } | null };
type BranchRow = { id: string; name: string; isActive: boolean; createdAt: string; tenant: { id: string; name: string; slug: string; isActive: boolean }; _count: { users: number; sales: number } };
const roles = ["OWNER", "ADMIN", "PHARMACIST", "DOCTOR", "RECEPTIONIST", "CASHIER", "ACCOUNTANT", "USER"];

export default function PlatformDirectory({ mode }: { mode: "users" | "branches" }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [query, setQuery] = useState("");
  const [tenantFilter, setTenantFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => { const value = new URLSearchParams(window.location.search).get("query"); if (value) setQuery(value); }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError("");
      try {
        const endpoint = mode === "users" ? "/api/super-admin/users" : "/api/super-admin/branches";
        const [directoryResponse, tenantResponse] = await Promise.all([fetch(endpoint, { cache: "no-store" }), fetch("/api/super-admin/tenants", { cache: "no-store" })]);
        const [directoryJson, tenantJson] = await Promise.all([directoryResponse.json(), tenantResponse.json()]);
        if (!directoryResponse.ok || !tenantResponse.ok) throw new Error(directoryJson.error || tenantJson.error || "Could not load platform directory");
        if (active) {
          if (mode === "users") setUsers(directoryJson.data);
          else setBranches(directoryJson.data);
          setTenants((tenantJson.data as (TenantOption & { slug: string })[]).filter((tenant) => tenant.slug !== "pharmacloud-platform"));
        }
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : "Could not load platform directory"); }
      finally { if (active) setLoading(false); }
    }
    void load(); return () => { active = false; };
  }, [mode]);

  const visibleUsers = useMemo(() => users.filter((user) => (tenantFilter === "all" || user.tenantId === tenantFilter) && (!query || `${user.fullName} ${user.email} ${user.role} ${user.tenant.name} ${user.branch?.name ?? ""}`.toLowerCase().includes(query.toLowerCase()))), [users, tenantFilter, query]);
  const visibleBranches = useMemo(() => branches.filter((branch) => (tenantFilter === "all" || branch.tenant.id === tenantFilter) && (!query || `${branch.name} ${branch.tenant.name} ${branch.tenant.slug}`.toLowerCase().includes(query.toLowerCase()))), [branches, tenantFilter, query]);

  async function updateUser(user: UserRow, update: { role?: string; isActive?: boolean }) {
    setBusy(user.id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/super-admin/tenants/${encodeURIComponent(user.tenantId)}/users`, { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id, ...update }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Could not update pharmacy user");
      setUsers((current) => current.map((entry) => entry.id === user.id ? { ...entry, ...payload.data } : entry));
      setNotice(`${user.fullName} was updated.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update pharmacy user"); }
    finally { setBusy(""); }
  }

  const count = mode === "users" ? users.length : branches.length;
  return <div className="platform-page">
    <header className="platform-page-heading"><div><span className="platform-eyebrow">{mode === "users" ? "BUSINESS DIRECTORY" : "BRANCH NETWORK"}</span><h1>{mode === "users" ? "Platform users" : "Branches"}</h1><p>{mode === "users" ? "View and manage staff accounts across all pharmacy workspaces." : "Review pharmacy branch locations and activity across the platform."}</p></div><button className="platform-secondary-button" onClick={() => window.location.reload()}>↻ Refresh</button></header>
    {error && <p className="platform-alert" role="alert">{error}</p>}{notice && <p className="platform-success" role="status">{notice}</p>}
    <section className="platform-panel">
      <div className="platform-directory-toolbar"><div><strong>{loading ? "—" : count.toLocaleString()}</strong><span>{mode === "users" ? "staff accounts" : "branch locations"}</span></div><label className="platform-directory-search"><span>Search</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={mode === "users" ? "Name, email, role or pharmacy" : "Branch or pharmacy name"} /></label><label className="platform-directory-filter"><span>Pharmacy</span><select value={tenantFilter} onChange={(event) => setTenantFilter(event.target.value)}><option value="all">All pharmacies</option>{tenants.map((tenant) => <option value={tenant.id} key={tenant.id}>{tenant.name}</option>)}</select></label></div>
      {mode === "users" ? loading ? <div className="platform-empty">Loading platform users…</div> : visibleUsers.length === 0 ? <div className="platform-empty"><strong>No users found</strong><span>Try another search or pharmacy filter.</span></div> : <div className="platform-table-wrap"><table className="platform-table"><thead><tr><th>User</th><th>Pharmacy</th><th>Branch</th><th>Role</th><th>Access</th><th>Joined</th></tr></thead><tbody>{visibleUsers.map((user) => { const knownRole = roles.includes(user.role); return <tr key={user.id}><td><strong>{user.fullName}</strong><small>{user.email}</small></td><td><Link className="platform-inline-link" href="/tenants">{user.tenant.name}</Link></td><td>{user.branch?.name ?? "—"}</td><td><select className="platform-inline-select" aria-label={`Role for ${user.fullName}`} value={knownRole ? user.role : "__current"} disabled={busy === user.id || user.role === "SUPER_ADMIN"} onChange={(event) => void updateUser(user, { role: event.target.value })}>{!knownRole && <option value="__current" disabled>{user.role} (legacy role)</option>}{roles.map((role) => <option value={role} key={role}>{role === "USER" ? "USER · Staff" : role}</option>)}</select></td><td><button className={`platform-small-button ${user.isActive ? "danger" : "positive"}`} disabled={busy === user.id || user.role === "SUPER_ADMIN"} onClick={() => void updateUser(user, { isActive: !user.isActive })}>{busy === user.id ? "Saving…" : user.isActive ? "Suspend" : "Restore"}</button></td><td>{new Date(user.createdAt).toLocaleDateString()}</td></tr>; })}</tbody></table></div> : loading ? <div className="platform-empty">Loading branch network…</div> : visibleBranches.length === 0 ? <div className="platform-empty"><strong>No branches found</strong><span>Create a pharmacy workspace to add its main branch.</span></div> : <div className="platform-table-wrap"><table className="platform-table"><thead><tr><th>Branch</th><th>Pharmacy</th><th>Staff</th><th>Sales records</th><th>Status</th><th>Created</th></tr></thead><tbody>{visibleBranches.map((branch) => <tr key={branch.id}><td><strong>{branch.name}</strong></td><td><strong>{branch.tenant.name}</strong><small>{branch.tenant.slug}</small></td><td>{branch._count.users}</td><td>{branch._count.sales.toLocaleString()}</td><td><Status active={branch.isActive && branch.tenant.isActive} /></td><td>{new Date(branch.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}

function Status({ active }: { active: boolean }) { return <span className={`platform-status ${active ? "is-active" : "is-inactive"}`}><i />{active ? "Active" : "Inactive"}</span>; }
