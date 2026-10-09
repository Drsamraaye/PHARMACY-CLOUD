"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Tenant = { id: string; name: string; slug: string; isActive: boolean; createdAt: string; _count: { users: number }; subscriptions: { plan: string; status: string; trialEnds: string | null }[] };
type PharmacyUser = { id: string; fullName: string; email: string; role: string; isActive: boolean; createdAt: string };

/** Provisions pharmacy workspaces and manages their users and activation state. */
export default function PharmacyManager() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [usersFor, setUsersFor] = useState("");
  const [users, setUsers] = useState<Record<string, PharmacyUser[]>>({});
  const [userFormFor, setUserFormFor] = useState("");
  const [busyTenant, setBusyTenant] = useState("");

  const loadTenants = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/super-admin/tenants", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load pharmacies");
      setTenants((payload.data as Tenant[]).filter((tenant) => tenant.slug !== "pharmacloud-platform"));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load pharmacies"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadTenants(); }, [loadTenants]);

  async function createPharmacy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    const data = { name: tenantName.trim(), slug: slug.trim(), ownerName: String(form.get("ownerName") ?? "").trim(), ownerEmail: String(form.get("ownerEmail") ?? "").trim(), ownerPassword: String(form.get("ownerPassword") ?? ""), trialDays: Number(form.get("trialDays") ?? 14) };
    try {
      const response = await fetch("/api/super-admin/tenants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not create pharmacy");
      setMessage(`${data.name} waa la diiwaan geliyey. Owner account-ka wuxuu isticmaali karaa email-ka la geliyey.`);
      setTenantName(""); setSlug(""); setSlugEdited(false); setFormOpen(false);
      await loadTenants();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create pharmacy"); }
    finally { setSaving(false); }
  }

  async function changeTenantStatus(tenant: Tenant) {
    setBusyTenant(tenant.id); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/super-admin/tenants/${encodeURIComponent(tenant.id)}`, { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !tenant.isActive }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(response.status === 401 ? "Session-ka Super Admin-ku ma shaqaynayo. Fadlan mar kale gal, kadibna isku day." : payload.error || "Could not update pharmacy status");
      setMessage(`${tenant.name} hadda waa ${tenant.isActive ? "inactive" : "active"}.`);
      await loadTenants();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update pharmacy status"); }
    finally { setBusyTenant(""); }
  }

  async function changeUserStatus(tenantId: string, user: PharmacyUser) {
    setBusyTenant(tenantId); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/super-admin/tenants/${encodeURIComponent(tenantId)}/users`, {
        method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, isActive: !user.isActive }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(response.status === 401 ? "Session-ka Super Admin-ku ma shaqaynayo. Fadlan mar kale gal, kadibna isku day." : payload.error || "Could not update user access");
      setUsers((current) => ({ ...current, [tenantId]: (current[tenantId] ?? []).map((entry) => entry.id === user.id ? { ...entry, isActive: payload.data.isActive } : entry) }));
      setMessage(`${user.fullName} akoonkiisa waa ${payload.data.isActive ? "la furay" : "la joojiyey"}.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update user access"); }
    finally { setBusyTenant(""); }
  }

  async function showUsers(tenant: Tenant) {
    setError("");
    if (usersFor === tenant.id) { setUsersFor(""); setUserFormFor(""); return; }
    setUsersFor(tenant.id); setUserFormFor(""); setBusyTenant(tenant.id);
    try {
      const response = await fetch(`/api/super-admin/tenants/${encodeURIComponent(tenant.id)}/users`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load pharmacy users");
      setUsers((current) => ({ ...current, [tenant.id]: payload.data }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load pharmacy users"); }
    finally { setBusyTenant(""); }
  }

  async function createUser(event: FormEvent<HTMLFormElement>, tenant: Tenant) {
    event.preventDefault(); setBusyTenant(tenant.id); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    const data = { fullName: String(form.get("fullName") ?? "").trim(), email: String(form.get("email") ?? "").trim(), password: String(form.get("password") ?? ""), role: String(form.get("role") ?? "PHARMACIST") };
    try {
      const response = await fetch(`/api/super-admin/tenants/${encodeURIComponent(tenant.id)}/users`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not create pharmacy user");
      setUsers((current) => ({ ...current, [tenant.id]: [...(current[tenant.id] ?? []), payload.data] }));
      setMessage(`User-ka ${data.fullName} waa lagu daray ${tenant.name}.`); setUserFormFor("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create pharmacy user"); }
    finally { setBusyTenant(""); }
  }

  return <div className="platform-page">
    <header className="platform-page-heading"><div><span className="platform-eyebrow">TENANT MANAGEMENT</span><h1>Pharmacies</h1><p>Diiwaan geli pharmacy cusub, maamul user accounts, ama hakad geli workspace.</p></div><button className="platform-primary-link platform-button" onClick={() => { setFormOpen((open) => !open); setError(""); }}>{formOpen ? "Xir form-ka" : "+ Diiwaan geli pharmacy"}</button></header>
    {error && <p role="alert" className="platform-alert">{error}</p>}{message && <p role="status" className="platform-success">{message}</p>}

    {formOpen && <section className="platform-panel pharmacy-create-panel"><div className="platform-panel-heading"><div><h2>Pharmacy cusub</h2><p>Waxay abuureysaa workspace, main branch, owner login, iyo trial subscription.</p></div></div><form className="platform-form-grid" onSubmit={createPharmacy}>
      <label>Magaca pharmacy-ga<input required minLength={2} maxLength={120} value={tenantName} onChange={(event) => { const value = event.target.value; setTenantName(value); if (!slugEdited) setSlug(toSlug(value)); }} placeholder="Tusaale: Nugaal Pharmacy" /></label>
      <label>Workspace slug<input required minLength={2} maxLength={60} pattern="[a-z0-9-]+" value={slug} onChange={(event) => { setSlug(toSlug(event.target.value)); setSlugEdited(true); }} placeholder="nugaal-pharmacy" /></label>
      <label>Owner-ka magaca<input name="ownerName" required minLength={2} maxLength={120} placeholder="Magaca buuxa" /></label>
      <label>Owner email<input name="ownerEmail" required type="email" placeholder="owner@pharmacy.com" /></label>
      <label>Password bilow ah<input name="ownerPassword" required type="password" minLength={8} autoComplete="new-password" placeholder="Ugu yaraan 8 xaraf" /></label>
      <label>Trial (maalmo)<input name="trialDays" required type="number" min={0} max={90} defaultValue={14} /></label>
      <div className="platform-form-actions"><button type="button" className="platform-secondary-button" onClick={() => setFormOpen(false)}>Cancel</button><button disabled={saving} className="platform-primary-link platform-button">{saving ? "Waa la abuurayaa…" : "Abuur pharmacy"}</button></div>
    </form></section>}

    <section className="platform-panel"><div className="platform-panel-heading"><div><h2>Liiska pharmacies</h2><p>{tenants.length} pharmacy workspace{tenants.length === 1 ? "" : "s"}</p></div><button className="platform-secondary-button" onClick={() => void loadTenants()}>Refresh</button></div>
      {loading ? <p className="platform-empty">Loading pharmacies…</p> : tenants.length === 0 ? <div className="platform-empty"><strong>Pharmacy wali lama abuurin.</strong><span>Isticmaal badhanka kore si aad u diiwaan geliso pharmacy-ga koowaad.</span></div> : <div className="platform-table-wrap"><table className="platform-table"><thead><tr><th>Pharmacy</th><th>Users</th><th>Plan</th><th>Status</th><th>La sameeyey</th><th>Actions</th></tr></thead><tbody>{tenants.map((tenant) => { const sub = tenant.subscriptions[0]; return <tr key={tenant.id}><td><strong>{tenant.name}</strong><small>{tenant.slug}</small></td><td>{tenant._count.users}</td><td>{sub ? <><strong>{sub.plan}</strong><small>{sub.status}{sub.trialEnds ? ` · ilaa ${new Date(sub.trialEnds).toLocaleDateString()}` : ""}</small></> : <span className="platform-muted">No plan</span>}</td><td><StatusPill active={tenant.isActive} /></td><td>{new Date(tenant.createdAt).toLocaleDateString()}</td><td className="platform-actions"><button className="platform-text-button" onClick={() => void showUsers(tenant)}>{usersFor === tenant.id ? "Qari users" : "Users"}</button><button className={`platform-small-button ${tenant.isActive ? "danger" : "positive"}`} disabled={busyTenant === tenant.id} onClick={() => void changeTenantStatus(tenant)}>{busyTenant === tenant.id ? "…" : tenant.isActive ? "Hakadi pharmacy" : "Fur pharmacy"}</button></td></tr>; })}</tbody></table></div>}
    </section>

    {usersFor && tenants.some((tenant) => tenant.id === usersFor) && <section className="platform-panel"><div className="platform-panel-heading"><div><span className="platform-eyebrow">STAFF ACCOUNTS</span><h2>{tenants.find((tenant) => tenant.id === usersFor)?.name} users</h2><p>Accounts-ka iyo roles-ka pharmacy-gan.</p></div><button className="platform-primary-link platform-button" onClick={() => setUserFormFor((current) => current ? "" : usersFor)}>{userFormFor ? "Xir form-ka" : "+ Ku dar user"}</button></div>
      {busyTenant === usersFor && !users[usersFor] ? <p className="platform-empty">Loading users…</p> : <div className="platform-table-wrap"><table className="platform-table"><thead><tr><th>Magaca</th><th>Email</th><th>Role</th><th>Account</th><th>La sameeyey</th><th>Action</th></tr></thead><tbody>{(users[usersFor] ?? []).map((user) => <tr key={user.id}><td><strong>{user.fullName}</strong></td><td>{user.email}</td><td><span className="platform-role-pill">{user.role}</span></td><td><StatusPill active={user.isActive} /></td><td>{new Date(user.createdAt).toLocaleDateString()}</td><td><button className={`platform-small-button ${user.isActive ? "danger" : "positive"}`} disabled={busyTenant === usersFor || user.role === "SUPER_ADMIN"} onClick={() => void changeUserStatus(usersFor, user)}>{busyTenant === usersFor ? "Waa la kaydinayaa…" : user.isActive ? "Jooji akoonka" : "Soo celi akoonka"}</button></td></tr>)}</tbody></table></div>}
      {userFormFor && <form className="platform-form-grid user-create-form" onSubmit={(event) => { const tenant = tenants.find((item) => item.id === userFormFor); if (tenant) void createUser(event, tenant); }}><label>Magaca buuxa<input name="fullName" required minLength={2} placeholder="Magaca user-ka" /></label><label>Email<input name="email" type="email" required placeholder="staff@pharmacy.com" /></label><label>Password bilow ah<input name="password" type="password" required minLength={8} autoComplete="new-password" /></label><label>Role<select name="role" defaultValue="PHARMACIST"><option value="OWNER">Owner</option><option value="ADMIN">Admin</option><option value="PHARMACIST">Pharmacist</option><option value="DOCTOR">Doctor</option><option value="RECEPTIONIST">Receptionist</option><option value="CASHIER">Cashier</option><option value="ACCOUNTANT">Accountant</option><option value="USER">Staff user</option></select></label><div className="platform-form-actions"><button disabled={busyTenant === userFormFor} className="platform-primary-link platform-button">{busyTenant === userFormFor ? "Waa la abuurayaa…" : "Abuur user"}</button></div></form>}
    </section>}
  </div>;
}

function StatusPill({ active }: { active: boolean }) {
  return <span className={`platform-status ${active ? "is-active" : "is-inactive"}`}><i />{active ? "Active" : "Inactive"}</span>;
}

function toSlug(value: string) {
  return value.toLocaleLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}
