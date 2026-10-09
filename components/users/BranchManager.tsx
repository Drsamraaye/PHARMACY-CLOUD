"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Branch = {
  id: string;
  name: string;
  createdAt: string;
  isActive: boolean;
  _count: { users: number; products: number; patients: number; sales: number; purchases: number };
};

export default function BranchManager() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/setup/branches", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Laamaha lama soo qaadi karin.");
      setBranches(payload.data ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Laamaha lama soo qaadi karin.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createBranch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") ?? "").trim();
    try {
      const response = await fetch("/api/setup/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Branch-ka lama abuuri karin.");
      form.reset();
      setNotice(`${name} waa la abuuray. Bogga Users & roles ayaad shaqaalaha ugu xireysaa branch-kan.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Branch-ka lama abuuri karin.");
    } finally {
      setSaving(false);
    }
  }

  async function renameBranch(branch: Branch) {
    const name = window.prompt("Branch name", branch.name);
    if (name === null || name.trim() === branch.name) return;
    try {
      const response = await fetch("/api/setup/branches", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: branch.id, name: name.trim() }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Branch lama cusboonaysiin karin."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Branch lama cusboonaysiin karin."); }
  }

  async function archiveBranch(branch: Branch) {
    if (!window.confirm(`Archive ${branch.name}? Only empty branches can be archived.`)) return;
    try {
      const response = await fetch("/api/setup/branches", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: branch.id }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Branch lama archive-gareyn karin."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Branch lama archive-gareyn karin."); }
  }

  const totals = branches.reduce((sum, branch) => ({
    users: sum.users + branch._count.users,
    products: sum.products + branch._count.products,
    patients: sum.patients + branch._count.patients,
  }), { users: 0, products: 0, patients: 0 });

  return (
    <main className="branch-admin-page">
      <div className="branch-admin-content">
        <header className="branch-admin-header">
          <div className="branch-admin-heading">
            <span className="branch-admin-heading-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none"><path d="M4 20V5.75C4 4.78 4.78 4 5.75 4h12.5c.97 0 1.75.78 1.75 1.75V20M2.5 20h19M8 8h2m4 0h2m-8 4h2m4 0h2M9 20v-3.5a3 3 0 0 1 6 0V20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <div>
              <p className="branch-admin-eyebrow">Pharmacy setup</p>
              <h1>Branches</h1>
              <p className="branch-admin-description">Branch kasta xogtiisa iyo shaqaalihiisa ayuu leeyahay. Halkan ka maamul laamaha pharmacy-gaaga.</p>
            </div>
          </div>
          <Link href="/users-management/users-list" className="branch-admin-link branch-admin-link-soft">
            <span aria-hidden="true">♙</span> Users &amp; roles
          </Link>
        </header>

        {error && <p role="alert" className="branch-admin-alert branch-admin-alert-error">{error}</p>}
        {notice && <p role="status" className="branch-admin-alert branch-admin-alert-success">{notice}</p>}

        <section className="branch-admin-actions">
          <div className="branch-admin-create-card">
            <div className="branch-admin-card-heading">
              <span className="branch-admin-plus" aria-hidden="true">+</span>
              <div><h2>Samee branch cusub</h2><p>Ku dar goob cusub oo xogteedu gooni u ahaan doonto.</p></div>
            </div>
            <form onSubmit={(event) => void createBranch(event)} className="branch-admin-form">
              <label>Magaca branch-ka
                <input name="name" required minLength={2} maxLength={100} placeholder="Tusaale: Branch 2" />
              </label>
              <button type="submit" disabled={saving}>{saving ? "Waa la abuurayaa…" : "Abuur branch"}</button>
            </form>
          </div>
          <aside className="branch-admin-callout">
            <p className="branch-admin-callout-eyebrow">Maamulka branch-ka</p>
            <h2>Xogtaada, branch kasta si gooni ah</h2>
            <p>Markaad branch abuurto, Users &amp; roles ka dooro shaqaalaha iyo role-ka ay ku shaqaynayaan.</p>
            <Link href="/users-management/users-list" className="branch-admin-link branch-admin-link-light">Maamul users-ka <span aria-hidden="true">→</span></Link>
          </aside>
        </section>

        <section className="branch-admin-stats" aria-label="Tirokoobka laamaha">
          <Stat label="Laamaha" value={branches.length} icon="▦" loading={loading} />
          <Stat label="Users la qoondeeyey" value={totals.users} icon="♙" loading={loading} />
          <Stat label="Products guud ahaan" value={totals.products} icon="◫" loading={loading} />
        </section>

        <section className="branch-admin-table-card">
          <div className="branch-admin-table-heading">
            <div><h2>Laamaha pharmacy-ga <span>{branches.length}</span></h2><p>Tirada users-ka iyo xogta branch kasta.</p></div>
            <button className="branch-admin-refresh" type="button" onClick={() => void load()} disabled={loading}>
              <svg className={loading ? "is-spinning" : ""} viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M16 8a6 6 0 0 0-10.8-2L4 8m0 0V4m0 4h4m-4 4a6 6 0 0 0 10.8 2L16 12m0 0v4m0-4h-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Refresh
            </button>
          </div>
          <div className="branch-admin-table-scroll">
            <table className="branch-admin-table">
              <thead><tr><th>Branch</th><th>Users</th><th>Products</th><th>Patients</th><th>Sales</th><th>Purchases</th><th>Maamul</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={7} className="branch-admin-empty"><span className="branch-admin-spinner" />Laamaha ayaa la soo rarayaa…</td></tr>
                  : branches.length === 0 ? <tr><td colSpan={7} className="branch-admin-empty"><span className="branch-admin-empty-icon">▦</span><strong>Branch wali lama abuurin</strong><small>Isticmaal foomka kore si aad u samayso branch-ka koowaad.</small></td></tr>
                  : branches.map((branch) => <tr key={branch.id}>
                      <td><div className="branch-admin-name"><span>{branch.name.slice(0, 1).toUpperCase()}</span><div><strong>{branch.name}</strong><small>La sameeyay {new Date(branch.createdAt).toLocaleDateString()}</small></div></div></td>
                      <td>{branch._count.users}</td><td>{branch._count.products}</td><td>{branch._count.patients}</td><td>{branch._count.sales}</td><td>{branch._count.purchases}</td>
                      <td><Link href="/users-management/users-list" className="branch-admin-manage">Users &amp; roles</Link><button type="button" className="branch-admin-edit" onClick={() => void renameBranch(branch)}>Edit</button><button type="button" className="branch-admin-delete" onClick={() => void archiveBranch(branch)}>Delete</button></td>
                    </tr>)}
              </tbody>
            </table>
          </div>
          {!loading && branches.length > 0 && <div className="branch-admin-table-footer">{totals.patients.toLocaleString()} bukaan oo ku kala jira laamaha.</div>}
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value, icon, loading }: { label: string; value: number; icon: string; loading: boolean }) {
  return <div className="branch-admin-stat"><div><p>{label}</p><strong>{loading ? "—" : value.toLocaleString()}</strong></div><span aria-hidden="true">{icon}</span></div>;
}
