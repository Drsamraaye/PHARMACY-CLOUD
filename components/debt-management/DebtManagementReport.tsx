"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Debt = { id: string; date: string; amount: number; customer: string; note: string };
const money = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function DebtManagementReport() {
  const [rows, setRows] = useState<Debt[]>([]);
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/debt-management?${new URLSearchParams({ search: term })}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Debt records could not be loaded.");
      setRows(result.data ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Debt records could not be loaded."); }
    finally { setLoading(false); }
  }, [term]);
  useEffect(() => { void load(); }, [load]);

  async function remove(row: Debt) {
    if (!window.confirm(`Delete debt for “${row.customer}”?`)) return;
    try {
      const response = await fetch("/api/debt-management", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Debt could not be deleted.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Debt could not be deleted."); }
  }

  return <main className="debt-list-page"><section className="debt-list-card">
    <div className="debt-list-toolbar"><Link className="debt-add-button" href="/debt-management/add">＋ Add</Link><form onSubmit={event => { event.preventDefault(); setTerm(search.trim()); }}><input aria-label="Search by customer name" placeholder="Search by Customer Name" value={search} onChange={event => setSearch(event.target.value)} /><button>⌕ Search</button></form></div>
    {error && <p className="debt-error" role="alert">{error}</p>}
    <header>List</header>
    <div className="debt-table-wrap"><table><thead><tr><th>#</th><th>Customer</th><th>Amount</th><th>Date</th><th>Note</th><th>Action</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={6} className="debt-empty">Loading…</td></tr> : rows.length ? rows.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td>{row.customer}</td><td>{money(row.amount)}</td><td>{new Date(row.date).toLocaleDateString()}</td><td>{row.note}</td><td><button className="debt-delete" onClick={() => void remove(row)}>Delete</button></td></tr>) : <tr><td colSpan={6} className="debt-empty">No Debts Found</td></tr>}
    </tbody></table></div>
  </section></main>;
}
