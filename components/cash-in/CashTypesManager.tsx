"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type CashType = { id: string; name: string; createdAt: string; createdBy: string };

export default function CashTypesManager() {
  const [rows, setRows] = useState<CashType[]>([]);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<CashType | null>(null);
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const response = await fetch("/api/cash-in/types", { cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Cash types lama soo rari karin."); setRows(result.data ?? []); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Cash types lama soo rari karin."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try { const response = await fetch("/api/cash-in/types", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), type: name.trim() }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Cash type lama kaydin karin."); setName(""); setNotice("Cash type waa la kaydiyey."); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Cash type lama kaydin karin."); }
    finally { setBusy(false); }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return; setBusy(true); setError("");
    try { const response = await fetch("/api/cash-in/types", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing.id, data: { name: editName.trim(), type: editName.trim() } }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Cash type lama cusboonaysiin karin."); setEditing(null); setNotice("Cash type waa la cusboonaysiiyey."); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Cash type lama cusboonaysiin karin."); }
    finally { setBusy(false); }
  }

  async function remove(row: CashType) {
    if (!window.confirm(`Delete cash type “${row.name}”?`)) return; setBusy(true); setError("");
    try { const response = await fetch("/api/cash-in/types", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Cash type lama tirtiri karin."); setNotice("Cash type waa la tirtiray."); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Cash type lama tirtiri karin."); }
    finally { setBusy(false); }
  }

  return <main className="cash-types-page"><section className="cash-types-card"><header><h1>Cash Types Management</h1><button type="button" onClick={() => void load()} disabled={loading}>Refresh</button></header>
    <form className="cash-types-add" onSubmit={submit}><h2>Add Cash Type</h2><label>Type <em>*</em><input required value={name} onChange={event => setName(event.target.value)} /></label><button disabled={busy}>{busy ? "Saving…" : "Save"}</button></form>
    {error && !editing && <p className="cash-types-error" role="alert">{error}</p>}{notice && <p className="cash-types-notice" role="status">{notice}</p>}
    <section className="cash-types-list"><h2>Cash Types Management</h2><div className="cash-types-table-wrap"><table><thead><tr><th>#</th><th>Name</th><th>Created By</th><th>Created At</th><th>Action</th></tr></thead><tbody>{loading ? <tr><td colSpan={5} className="cash-types-empty">Loading…</td></tr> : rows.length ? rows.map((row,index)=><tr key={row.id}><td>{index+1}</td><td>{row.name}</td><td>{row.createdBy}</td><td>{new Date(row.createdAt).toLocaleDateString()}</td><td><button className="cash-types-edit" disabled={busy} onClick={()=>{setEditing(row);setEditName(row.name);setError("");}}>Edit</button><button className="cash-types-delete" disabled={busy} onClick={()=>void remove(row)}>Delete</button></td></tr>) : <tr><td colSpan={5} className="cash-types-empty">No cash types found.</td></tr>}</tbody></table></div></section>
    {editing && <div className="cash-types-overlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)setEditing(null);}}><form className="cash-types-modal" onSubmit={saveEdit}><header><strong>Edit Cash Type</strong><button type="button" onClick={()=>setEditing(null)}>×</button></header><label>Type<input required value={editName} onChange={event=>setEditName(event.target.value)}/></label>{error&&<p className="cash-types-error" role="alert">{error}</p>}<footer><button type="button" onClick={()=>setEditing(null)}>Cancel</button><button disabled={busy}>{busy?"Saving…":"Save"}</button></footer></form></div>}
  </section></main>;
}
