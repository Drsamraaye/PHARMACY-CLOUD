"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Tenant = { id: string; name: string; slug: string };
type StaffUser = { id: string; tenantId: string; tenantName: string; fullName: string; email: string; role: string; isActive: boolean; createdAt: string };
const roles = ["OWNER", "ADMIN", "PHARMACIST", "DOCTOR", "RECEPTIONIST", "CASHIER", "ACCOUNTANT", "USER"];

/** Platform-wide view for pharmacy staff role assignments and account access. */
export default function PlatformRoleManager() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantFilter, setTenantFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyUser, setBusyUser] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const tenantResponse = await fetch("/api/super-admin/tenants", { cache: "no-store" });
      const tenantPayload = await tenantResponse.json();
      if (!tenantResponse.ok) throw new Error(tenantPayload.error || "Could not load pharmacies");
      const pharmacyList = (tenantPayload.data as (Tenant & { slug: string })[]).filter((tenant) => tenant.slug !== "pharmacloud-platform");
      const userResponses = await Promise.all(pharmacyList.map(async (tenant) => {
        const response = await fetch(`/api/super-admin/tenants/${encodeURIComponent(tenant.id)}/users`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || `Could not load ${tenant.name} users`);
        return (payload.data as Omit<StaffUser, "tenantId" | "tenantName">[]).map((user) => ({ ...user, tenantId: tenant.id, tenantName: tenant.name }));
      }));
      setTenants(pharmacyList);
      setUsers(userResponses.flat());
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load pharmacy roles"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => (tenantFilter === "all" || user.tenantId === tenantFilter)
      && (!query || `${user.fullName} ${user.email} ${user.role} ${user.tenantName}`.toLowerCase().includes(query)));
  }, [users, tenantFilter, search]);
  const activeUsers = users.filter((user) => user.isActive).length;
  const roleCount = new Set(users.map((user) => user.role)).size;

  async function updateUser(user: StaffUser, update: { role?: string; isActive?: boolean }) {
    setBusyUser(user.id); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/super-admin/tenants/${encodeURIComponent(user.tenantId)}/users`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id, ...update }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not update this account");
      setUsers((current) => current.map((item) => item.id === user.id ? { ...item, ...payload.data } : item));
      setMessage(`${user.fullName} waa la cusboonaysiiyey.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update this account"); }
    finally { setBusyUser(""); }
  }

  return <div className="platform-page">
    <header className="platform-page-heading"><div><span className="platform-eyebrow">ACCESS CONTROL</span><h1>Roles & access</h1><p>Maamul roles-ka shaqaalaha iyo gelitaanka pharmacy kasta.</p></div><button className="platform-secondary-button" onClick={() => void load()} disabled={loading}>Refresh</button></header>
    {error && <p role="alert" className="platform-alert">{error}</p>}{message && <p role="status" className="platform-success">{message}</p>}
    <section className="platform-metrics role-metrics" aria-label="User access metrics">
      <RoleMetric label="Pharmacy users" value={loading ? "—" : users.length} hint="Across all pharmacy workspaces" />
      <RoleMetric label="Active accounts" value={loading ? "—" : activeUsers} hint="Users currently able to sign in" />
      <RoleMetric label="Roles in use" value={loading ? "—" : roleCount} hint="Owner, admin, clinical and team roles" />
      <RoleMetric label="Pharmacies" value={loading ? "—" : tenants.length} hint="Workspaces with managed access" />
    </section>
    <section className="platform-panel">
      <div className="platform-panel-heading"><div><h2>Pharmacy staff</h2><p>Dooro role ku habboon shaqada user-ka. Owner iyo Admin waxay helaan awoodaha maamulka; staff roles-ka kale waxay raacaan permission group-ka pharmacy-ga.</p></div></div>
      <div className="platform-role-filters"><label>Raadi user<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Magac, email, pharmacy ama role" /></label><label>Pharmacy<select value={tenantFilter} onChange={(event) => setTenantFilter(event.target.value)}><option value="all">Dhammaan pharmacies</option>{tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}</select></label></div>
      {loading ? <p className="platform-empty">Loading role assignments…</p> : visibleUsers.length === 0 ? <div className="platform-empty"><strong>{users.length ? "Natiijo lama helin." : "Weli users pharmacy ah ma jiraan."}</strong><span>{users.length ? "Beddel raadinta ama pharmacy filter-ka." : "Marka hore diiwaan geli pharmacy oo ku dar staff users."}</span></div> : <div className="platform-table-wrap"><table className="platform-table"><thead><tr><th>User</th><th>Pharmacy</th><th>Role</th><th>Access</th><th>Joined</th></tr></thead><tbody>{visibleUsers.map((user) => { const knownRole = roles.includes(user.role); return <tr key={user.id}><td><strong>{user.fullName}</strong><small>{user.email}</small></td><td>{user.tenantName}</td><td><select className="platform-inline-select" aria-label={`Role for ${user.fullName}`} value={knownRole ? user.role : "__current"} disabled={busyUser === user.id || user.role === "SUPER_ADMIN"} onChange={(event) => void updateUser(user, { role: event.target.value })}>{!knownRole && <option value="__current" disabled>{user.role} (legacy role)</option>}{roles.map((role) => <option key={role} value={role}>{role === "USER" ? "USER · Staff" : role}</option>)}</select></td><td><button className={`platform-small-button ${user.isActive ? "danger" : "positive"}`} disabled={busyUser === user.id || user.role === "SUPER_ADMIN"} onClick={() => void updateUser(user, { isActive: !user.isActive })}>{busyUser === user.id ? "Saving…" : user.isActive ? "Active · Suspend" : "Inactive · Restore"}</button></td><td>{new Date(user.createdAt).toLocaleDateString()}</td></tr>; })}</tbody></table></div>}
    </section>
    <section className="platform-panel role-guide"><div className="platform-panel-heading"><div><h2>Role guide</h2><p>Roles-ka shaqaalaha waxay adeegsanayaan privilege groups-ka pharmacy-ga.</p></div></div><div className="platform-role-guide-grid"><RoleGuide role="OWNER" description="Maamulka buuxa ee pharmacy-ga, laamaha iyo shaqaalaha." /><RoleGuide role="ADMIN" description="Hawlaha maamulka iyo dejimaha maamulka." /><RoleGuide role="PHARMACIST" description="Kaydka daawooyinka, iibka iyo hawlaha farmashiyaha; permissions-ka waxaa maamula group-ka." /><RoleGuide role="DOCTOR" description="Bukaanka, prescriptions iyo hawlaha caafimaadka; permissions-ka waxaa maamula group-ka." /><RoleGuide role="RECEPTIONIST" description="Diiwaangelinta bukaanka iyo hawlaha reception-ka; permissions-ka waxaa maamula group-ka." /><RoleGuide role="CASHIER / ACCOUNTANT / USER" description="Lacag-bixinta, iibka iyo hawlaha guud; permissions-ka waxaa maamula group-ka." /></div></section>
  </div>;
}

function RoleMetric({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return <article className="platform-metric"><span className="platform-metric-label">{label}</span><strong>{value}</strong><small>{hint}</small></article>;
}

function RoleGuide({ role, description }: { role: string; description: string }) {
  return <article><span className="platform-role-pill">{role}</span><p>{description}</p></article>;
}
