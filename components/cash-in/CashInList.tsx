"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type CashRow = { id: string; createdAt: string; date: string; type: string; amount: number; note: string; userId: string; user: string };
type Option = { id: string; name?: string; fullName?: string };
type CashForm = { id?: string; type: string; amount: string; date: string; note: string };
const money = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; };

export default function CashInList() {
  const [rows, setRows] = useState<CashRow[]>([]);
  const [types, setTypes] = useState<Option[]>([]);
  const [users, setUsers] = useState<Option[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState("");
  const [userId, setUserId] = useState("");
  const [form, setForm] = useState<CashForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ from, to, type, userId });
      const response = await fetch(`/api/cash-in?${query}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Cash in records lama soo rari karin.");
      setRows(result.data ?? []);
      setTypes(result.options?.types ?? []);
      setUsers(result.options?.users ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Cash in records lama soo rari karin.");
    } finally { setLoading(false); }
  }, [from, to, type, userId]);

  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setBusy(true); setError("");
    const payload = { type: form.type, amount: Number(form.amount), total: Number(form.amount), date: form.date, note: form.note, description: form.note };
    try {
      const response = await fetch("/api/cash-in", { method: form.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form.id ? { id: form.id, data: payload } : payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Cash in lama kaydin karin.");
      setNotice(form.id ? "Cash in waa la cusboonaysiiyey." : "Cash in waa la kaydiyey.");
      setForm(null); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Cash in lama kaydin karin."); }
    finally { setBusy(false); }
  }

  async function remove(row: CashRow) {
    if (!window.confirm(`Delete cash-in entry “${row.type}”?`)) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/cash-in", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Cash in lama tirtiri karin.");
      setNotice("Cash in waa la tirtiray."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Cash in lama tirtiri karin."); }
    finally { setBusy(false); }
  }

  const total = rows.reduce((sum, row) => sum + row.amount, 0);

  return <main className="cash-in-page"><section className="cash-in-card">
    <header><h1>Cash In List</h1><button type="button" className="cash-in-add" onClick={() => { window.location.href = "/cash-in/new"; }}>Add New</button></header>
    <div className="cash-in-filters"><label>Date From<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label>Date To<input type="date" value={to} onChange={event => setTo(event.target.value)} /></label><label>Cash Type<select value={type} onChange={event => setType(event.target.value)}><option value="">All Types</option>{types.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label><label>User<select value={userId} onChange={event => setUserId(event.target.value)}><option value="">All Users</option>{users.map(item => <option key={item.id} value={item.id}>{item.fullName ?? item.name}</option>)}</select></label><button type="button" onClick={() => void load()} disabled={loading}>{loading ? "Loading…" : "Filter"}</button></div>
    {error && !form && <p className="cash-in-error" role="alert">{error}</p>}{notice && <p className="cash-in-notice" role="status">{notice}</p>}
    <div className="cash-in-table-wrap"><table><thead><tr><th>#</th><th>Date</th><th>Type</th><th>Amount</th><th>User</th><th>Note</th><th>Action</th></tr></thead><tbody>{loading ? <tr><td colSpan={7} className="cash-in-empty">Loading…</td></tr> : rows.length ? rows.map((row,index) => <tr key={row.id}><td>{index+1}</td><td>{new Date(row.date || row.createdAt).toLocaleDateString()}</td><td>{row.type}</td><td>{money(row.amount)}</td><td>{row.user}</td><td>{row.note}</td><td><button className="cash-in-edit" disabled={busy} onClick={() => { setError(""); setForm({id:row.id,type:row.type,amount:String(row.amount),date:String(row.date).slice(0,10),note:row.note === "—" ? "" : row.note}); }}>Edit</button><button className="cash-in-delete" disabled={busy} onClick={() => void remove(row)}>Delete</button></td></tr>) : <tr><td colSpan={7} className="cash-in-empty">No cash-in records found.</td></tr>}{!loading && rows.length > 0 && <tr className="cash-in-total"><td colSpan={3}></td><th>Total Cash In: {money(total)}</th><td colSpan={3}></td></tr>}</tbody></table></div>
    {form && <div className="cash-in-overlay" role="presentation" onMouseDown={event => { if(event.target===event.currentTarget&&!busy)setForm(null); }}><form className="cash-in-modal" onSubmit={save}><header><strong>{form.id ? "Edit Cash In" : "Add New Cash In"}</strong><button type="button" aria-label="Close" onClick={() => setForm(null)}>×</button></header><label>Cash Type{types.length ? <select required value={form.type} onChange={event=>setForm({...form,type:event.target.value})}><option value="">Select cash type</option>{types.map(item=><option key={item.id} value={item.name}>{item.name}</option>)}</select> : <input required value={form.type} onChange={event=>setForm({...form,type:event.target.value})} placeholder="Cash type" />}</label><label>Amount<input type="number" min="0.01" step="0.01" required value={form.amount} onChange={event=>setForm({...form,amount:event.target.value})} /></label><label>Date<input type="date" required value={form.date} onChange={event=>setForm({...form,date:event.target.value})} /></label><label>Note<input value={form.note} onChange={event=>setForm({...form,note:event.target.value})} /></label>{error && <p className="cash-in-error" role="alert">{error}</p>}<footer><button type="button" disabled={busy} onClick={()=>setForm(null)}>Cancel</button><button disabled={busy}>{busy?"Saving…":"Save"}</button></footer></form></div>}
  </section></main>;
}
