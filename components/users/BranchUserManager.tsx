"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Branch = { id: string; name: string };
type Staff = { id: string; fullName: string; email: string; role: string; branchId: string | null; isActive: boolean; createdAt: string };
const roles = ["OWNER", "ADMIN", "PHARMACIST", "DOCTOR", "RECEPTIONIST", "CASHIER", "ACCOUNTANT", "USER"];

export default function BranchUserManager() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentRole, setCurrentRole] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [newUserBranch, setNewUserBranch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [staffResponse, branchesResponse, sessionResponse] = await Promise.all([
        fetch("/api/users", { cache: "no-store" }),
        fetch("/api/setup/branches", { cache: "no-store" }),
        fetch("/api/auth/session", { cache: "no-store" }),
      ]);
      const [staffBody, branchBody, sessionBody] = await Promise.all([staffResponse.json(), branchesResponse.json(), sessionResponse.json()]);
      const failedIndex = [staffResponse, branchesResponse].findIndex((response) => !response.ok);
      if (failedIndex !== -1) throw new Error([staffBody, branchBody][failedIndex]?.error || "Xogta users-ka lama soo qaadi karin.");
      setStaff(staffBody.data ?? []);
      setBranches(branchBody.data ?? []);
      setCurrentRole(sessionBody.data?.role ?? "");
      setCurrentUserId(sessionBody.data?.id ?? "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Xogta users-ka lama soo qaadi karin.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visibleStaff = useMemo(() => branchFilter === "all" ? staff : staff.filter((entry) => entry.branchId === branchFilter), [branchFilter, staff]);
  const selectedBranchName = branchFilter === "all" ? "dhammaan laamaha" : branches.find((branch) => branch.id === branchFilter)?.name ?? "branch-ka";

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy("new");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const values = {
      fullName: String(form.get("fullName") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
      role: String(form.get("role") ?? "USER"),
      branchId: String(form.get("branchId") ?? ""),
    };
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "User-ka lama abuuri karin.");
      formElement.reset();
      setNewUserBranch(branchFilter === "all" ? "" : branchFilter);
      setNotice(`${values.fullName} waxaa lagu daray ${branches.find((branch) => branch.id === values.branchId)?.name ?? "branch-ka"}.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "User-ka lama abuuri karin.");
    } finally {
      setBusy("");
    }
  }

  async function update(staffUser: Staff, fields: Partial<Pick<Staff, "role" | "branchId" | "isActive">>) {
    setBusy(staffUser.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(staffUser.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Isbeddelka lama kaydin.");
      setStaff((old) => old.map((entry) => entry.id === staffUser.id ? { ...entry, ...result.data } : entry));
      setNotice(`${staffUser.fullName} waa la cusboonaysiiyey.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Isbeddelka lama kaydin.");
    } finally {
      setBusy("");
    }
  }

  const activeCount = visibleStaff.filter((entry) => entry.isActive).length;
  const unassignedCount = visibleStaff.filter((entry) => !entry.branchId).length;

  return (
    <main className="branch-users-page">
      <div className="branch-users-content">
        <header className="branch-users-header">
          <div className="branch-users-title">
            <span className="branch-users-title-icon" aria-hidden="true">♙</span>
            <div><p className="branch-users-eyebrow">Branch access</p><h1>Users iyo roles</h1><p>User kasta ku xidh branch iyo role. Staff-ku wuxuu arkaa xogta branch-kiisa oo keliya.</p></div>
          </div>
          <div className="branch-users-header-actions">
            <Link href="/setup/branches" className="branch-users-secondary">Laamaha</Link>
            <button type="button" className="branch-users-secondary" onClick={() => void load()} disabled={loading}><span aria-hidden="true">↻</span> Refresh</button>
          </div>
        </header>

        {error && <p role="alert" className="branch-users-alert branch-users-error">{error}</p>}
        {notice && <p role="status" className="branch-users-alert branch-users-success">{notice}</p>}

        <section className="branch-users-create-card">
          <div className="branch-users-section-title"><span aria-hidden="true">+</span><div><h2>Ku dar user cusub</h2><p>Dooro branch-ka iyo role-ka user-kan loo samaynayo.</p></div></div>
          {branches.length === 0 && !loading && <p className="branch-users-no-branches">Marka hore samee branch; user lama abuuri karo ilaa branch loo qoondeeyo.</p>}
          <form onSubmit={(event) => void createUser(event)} className="branch-users-form">
            <label>Magaca<input name="fullName" required minLength={2} placeholder="Magaca user-ka" /></label>
            <label>Email<input name="email" type="email" required placeholder="name@pharmacy.com" /></label>
            <label>Password ku meel gaar ah<input name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="Ugu yaraan 8 xaraf" /></label>
            <label>Role<select name="role" defaultValue="USER">{roles.map((role) => <option key={role} value={role} disabled={role === "OWNER" && currentRole !== "OWNER"}>{role}</option>)}</select></label>
            <label>Branch<select name="branchId" value={newUserBranch} onChange={(event) => setNewUserBranch(event.target.value)} required><option value="" disabled>Dooro branch</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
            <button type="submit" disabled={busy === "new" || branches.length === 0 || !newUserBranch}>{busy === "new" ? "Waa la abuurayaa…" : "Abuur user"}</button>
          </form>
        </section>

        <section className="branch-users-summary">
          <article><span aria-hidden="true">♙</span><div><small>Users {branchFilter === "all" ? "guud ahaan" : "branch-kan"}</small><strong>{loading ? "—" : visibleStaff.length}</strong></div></article>
          <article><span className="branch-users-dot branch-users-dot-active" aria-hidden="true"/><div><small>Aktoon firfircoon</small><strong>{loading ? "—" : activeCount}</strong></div></article>
          <article><span className="branch-users-dot branch-users-dot-warning" aria-hidden="true"/><div><small>Branch loo qoondeeyo</small><strong>{loading ? "—" : unassignedCount}</strong></div></article>
        </section>

        <section className="branch-users-table-card">
          <div className="branch-users-table-heading">
            <div><p className="branch-users-eyebrow">Shaqaalaha pharmacy-ga</p><h2>Users-ka {selectedBranchName}</h2><p>Branch kasta wuxuu leeyahay users u gaar ah; xogta app-kana branch-kaas ayaa lagu xaddidayaa.</p></div>
            <label className="branch-users-filter">Shaandhee branch-ka<select value={branchFilter} onChange={(event) => { setBranchFilter(event.target.value); setNewUserBranch(event.target.value === "all" ? "" : event.target.value); }}><option value="all">Dhammaan laamaha</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          </div>
          <div className="branch-users-table-wrap"><table className="branch-users-table"><thead><tr><th>User</th><th>Branch</th><th>Role</th><th>Xaalad</th><th>Gelitaan</th></tr></thead><tbody>
            {loading ? <tr><td colSpan={5} className="branch-users-empty">Users-ka ayaa la soo rarayaa…</td></tr>
              : visibleStaff.length === 0 ? <tr><td colSpan={5} className="branch-users-empty"><strong>{branchFilter === "all" ? "Weli user lama diiwaangelin" : `User wali kuma jiro ${selectedBranchName}`}</strong><small>Foomka kore ka samee user oo u dooro branch-kan.</small></td></tr>
                : visibleStaff.map((entry) => <tr key={entry.id}>
                  <td><div className="branch-users-person"><span>{entry.fullName.slice(0, 1).toUpperCase()}</span><div><strong>{entry.fullName}</strong><small>{entry.email}</small></div></div></td>
                  <td><select aria-label={`Branch for ${entry.fullName}`} disabled={busy === entry.id || entry.role === "SUPER_ADMIN"} value={entry.branchId ?? ""} onChange={(event) => void update(entry, { branchId: event.target.value || null })}><option value="">Branch ma leh</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></td>
                  <td><select aria-label={`Role for ${entry.fullName}`} disabled={busy === entry.id || entry.role === "SUPER_ADMIN"} value={entry.role} onChange={(event) => void update(entry, { role: event.target.value })}>{!roles.includes(entry.role) && <option value={entry.role} disabled>{entry.role} (hore)</option>}{roles.map((role) => <option key={role} value={role} disabled={role === "OWNER" && currentRole !== "OWNER"}>{role}</option>)}</select></td>
                  <td><span className={`branch-users-status ${entry.isActive ? "is-active" : "is-inactive"}`}><i />{entry.isActive ? "Active" : "Inactive"}</span></td>
                  <td><button type="button" className={`branch-users-toggle ${entry.isActive ? "toggle-disable" : "toggle-enable"}`} disabled={busy === entry.id || entry.id === currentUserId} onClick={() => void update(entry, { isActive: !entry.isActive })}>{busy === entry.id ? "Kaydin…" : entry.id === currentUserId ? "Adiga" : entry.isActive ? "Jooji" : "Dib u fur"}</button></td>
                </tr>)}
          </tbody></table></div>
          <footer className="branch-users-footer">User kasta waxaa lagu aqoonsadaa branch-ka iyo role-ka loo qoondeeyey.</footer>
        </section>
      </div>
    </main>
  );
}
