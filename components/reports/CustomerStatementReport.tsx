"use client";

import { useCallback, useEffect, useState } from "react";

type Row = { id: string; date: string; patient: string; user: string; branch: string; type: string; income: number; paid: number; balance: number };
type Option = { id: string; fullName?: string; name?: string };
const dateString = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const amount = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CustomerStatementReport() {
  const today = new Date();
  const [from, setFrom] = useState(dateString(today));
  const [to, setTo] = useState(dateString(today));
  const [patientId, setPatientId] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("patientId") || "");
  const [userId, setUserId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [type, setType] = useState("");
  const [balance, setBalance] = useState("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [patients, setPatients] = useState<Option[]>([]);
  const [users, setUsers] = useState<Option[]>([]);
  const [branches, setBranches] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ from, to, patientId, userId, branchId, type, balance });
      const response = await fetch(`/api/reports/customer-statement?${query}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Customer statement lama soo rari karin.");
      setRows(result.data ?? []);
      setPatients(result.options?.patients ?? []);
      setUsers(result.options?.users ?? []);
      setBranches(result.options?.branches ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Customer statement lama soo rari karin.");
    } finally {
      setLoading(false);
    }
  }, [from, to, patientId, userId, branchId, type, balance]);

  useEffect(() => { void load(); }, [load]);
  const dateLabel = (value: string) => new Date(value).toLocaleDateString();

  return <main className="customer-statement-page"><section className="customer-statement-card">
    <header>Customer Statement Report</header>
    <div className="customer-statement-filters">
      <label>Date<div><input aria-label="Start date" type="date" value={from} onChange={event => setFrom(event.target.value)} /><span>to</span><input aria-label="End date" type="date" value={to} onChange={event => setTo(event.target.value)} /></div></label>
      <label>Name<select value={patientId} onChange={event => setPatientId(event.target.value)}><option value="">All</option>{patients.map(item => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></label>
      <label>User<select value={userId} onChange={event => setUserId(event.target.value)}><option value="">All</option>{users.map(item => <option key={item.id} value={item.id}>{item.fullName ?? item.name}</option>)}</select></label>
      <label>Type<select value={type} onChange={event => setType(event.target.value)}><option value="">All</option><option value="PHARMACY">Pharmacy</option><option value="SERVICE">Service</option></select></label>
      <label>Balance<select value={balance} onChange={event => setBalance(event.target.value)}><option value="all">All</option><option value="due">Outstanding</option><option value="paid">Paid</option></select></label>
      {branches.length > 0 && <label>Branch<select value={branchId} onChange={event => setBranchId(event.target.value)}><option value="">All</option>{branches.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    </div>
    <div className="customer-statement-actions"><button type="button" onClick={() => void load()} disabled={loading}>{loading ? "Loading…" : "Search"}</button><button type="button" onClick={() => window.print()}>Print</button></div>
    {error && <p className="customer-statement-error" role="alert">{error}</p>}
    <div className="customer-statement-table-wrap"><table><thead><tr><th>Date</th><th>Name</th><th>User</th><th>Branch</th><th>Type</th><th>In</th><th>Out</th><th>Balance</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={8} className="customer-statement-empty">Loading…</td></tr> : rows.length ? rows.map(row => <tr key={row.id}><td>{dateLabel(row.date)}</td><td>{row.patient}</td><td>{row.user}</td><td>{row.branch}</td><td>{row.type}</td><td><span className="customer-statement-amount">{amount(row.income)}</span></td><td><span className="customer-statement-amount">{amount(row.paid)}</span></td><td>{amount(row.balance)}</td></tr>) : <tr><td colSpan={8} className="customer-statement-empty">No customer statement records found.</td></tr>}
    </tbody></table></div>
  </section></main>;
}
