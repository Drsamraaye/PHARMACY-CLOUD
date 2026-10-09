"use client";

import { useCallback, useEffect, useState } from "react";

type Branch = { id: string; name: string };

/** Lists branches and reveals the header switcher once another branch is created. */
export default function BranchManagement() {
  const [branches, setBranches] = useState<Branch[]>([]); const [name, setName] = useState(""); const [adding, setAdding] = useState(false); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); try { const response = await fetch("/api/setup/branches", { cache: "no-store" }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Branches lama soo rari karin."); setBranches(payload.data ?? []); } catch (cause) { setError(cause instanceof Error ? cause.message : "Branches lama soo rari karin."); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  async function create(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(""); try { const response = await fetch("/api/setup/branches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Branch lama abuuri karin."); setName(""); setAdding(false); window.location.reload(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Branch lama abuuri karin."); setSaving(false); } }
  return <main className="branch-management-page"><section className="branch-management-card"><header><div><span>WORKSPACE SETTINGS</span><h1>Branches</h1><p>Maamul branches-ka pharmacy-ga.</p></div><button onClick={() => { setAdding((open) => !open); setError(""); }}>{adding ? "Cancel" : "+ Add branch"}</button></header>
    {adding && <form className="branch-create-form" onSubmit={create}><label>Branch name<input autoFocus required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter branch name" /></label><button disabled={saving}>{saving ? "Saving…" : "Create branch"}</button></form>}
    {error && <p className="branch-management-error" role="alert">{error}</p>}
    <div className="branch-table-wrap"><table><thead><tr><th>#</th><th>Branch name</th><th>Branch ID</th></tr></thead><tbody>{loading ? <tr><td colSpan={3} className="empty">Loading branches…</td></tr> : !branches.length ? <tr><td colSpan={3} className="empty">No branches found.</td></tr> : branches.map((branch, index) => <tr key={branch.id}><td>{index + 1}</td><td>{branch.name}</td><td>{branch.id}</td></tr>)}</tbody></table></div>
    {branches.length < 2 && <p className="branch-switcher-hint">Branch selector-ka wuxuu soo muuqan doonaa marka branch kale la abuuro.</p>}
  </section></main>;
}
