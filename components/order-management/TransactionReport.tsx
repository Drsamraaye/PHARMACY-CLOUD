"use client";

import { useCallback, useEffect, useState } from "react";

type Entry = { id: string; date: string; customer: string; phone: string; section: string; paymentMethod: string; account: string; user: string; quantity: number; out: number; in: number; balance: number; currency: string; details: string };
type Option = { id: string; name: string };
type Report = { data: Entry[]; options: { customers: Option[]; users: Option[]; paymentMethods: string[]; totalQuantity: number; totalOut: number; totalIn: number; endingBalance: number } };
const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };
const currency = (value: number, code = "USD") => `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${/^[A-Z]{3}$/.test(code) ? code : "USD"}`;
const sumByCurrency = (rows: Entry[], field: "out" | "in") => { const sums = new Map<string, number>(); for (const row of rows) sums.set(row.currency, (sums.get(row.currency) || 0) + row[field]); return [...sums].map(([code, value]) => currency(value, code)).join(" · ") || currency(0); };

export default function TransactionReport() {
  const [report, setReport] = useState<Report | null>(null);
  const [from, setFrom] = useState(today()); const [to, setTo] = useState(today());
  const [customerId, setCustomerId] = useState(""); const [userId, setUserId] = useState(""); const [paymentMethod, setPaymentMethod] = useState(""); const [type, setType] = useState("ALL"); const [account, setAccount] = useState("ALL");
  const [reportType, setReportType] = useState("Details");
  const [branchName, setBranchName] = useState("Active branch"); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [selected, setSelected] = useState<Entry | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const params = new URLSearchParams({ from, to, customerId, userId, paymentMethod, type, account }); const response = await fetch(`/api/order-management/my-transactions?${params}`, { cache: "no-store" }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Transactions lama soo rari karin."); setReport(payload); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Transactions lama soo rari karin."); }
    finally { setLoading(false); }
  }, [from, to, customerId, userId, paymentMethod, type, account]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { Promise.all([fetch("/api/setup/branches").then((r) => r.ok ? r.json() : null), fetch("/api/auth/session").then((r) => r.ok ? r.json() : null)]).then(([branches, session]) => setBranchName(branches?.data?.find((branch: Option) => branch.id === session?.data?.branchId)?.name ?? branches?.data?.[0]?.name ?? "All branches")).catch(() => undefined); }, []);
  const accounts = [...new Set((report?.data ?? []).map((entry) => entry.account).filter((name) => name && name !== "—"))];
  const filtered = (report?.data ?? []).filter((entry) => account === "ALL" || entry.account === account);
  const shown = reportType === "Summary" ? [...new Map(filtered.map((entry) => [`${entry.section}|${entry.paymentMethod}|${entry.currency}`, entry])).values()].map((entry) => { const group = filtered.filter((row) => row.section === entry.section && row.paymentMethod === entry.paymentMethod && row.currency === entry.currency); return { ...entry, id: `${entry.section}-${entry.paymentMethod}-${entry.currency}`, date: to, customer: `${group.length} transactions`, phone: "—", quantity: group.reduce((sum, row) => sum + row.quantity, 0), out: group.reduce((sum, row) => sum + row.out, 0), in: group.reduce((sum, row) => sum + row.in, 0), balance: group[0]?.balance ?? 0, details: `${group.length} transaction(s)` }; }) : filtered;
  return <div className="transaction-page"><section className="transaction-card">
    <header className="transaction-heading"><h1>My Transactions</h1><span>{branchName}</span></header>
    <form className="transaction-filters" onSubmit={(event) => { event.preventDefault(); void load(); }}>
      <label><span>Branch</span><select value={branchName} disabled><option>{branchName}</option></select></label>
      <label className="transaction-range"><span>▦ Date Range</span><div><input aria-label="Start date" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /><b>–</b><input aria-label="End date" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></div></label>
      <label><span>Customer</span><select value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">All</option>{report?.options.customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label><span>User</span><select value={userId} onChange={(event) => setUserId(event.target.value)}><option value="">All</option>{report?.options.users.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label><span>Payment Method</span><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="">All</option>{report?.options.paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
      <label><span>Account</span><select value={account} onChange={(event) => setAccount(event.target.value)}><option value="ALL">All</option>{accounts.map((name) => <option key={name}>{name}</option>)}</select></label>
      <label><span>Type</span><select value={type} onChange={(event) => setType(event.target.value)}><option value="ALL">All</option><option value="PHARMACY">Pharmacy</option><option value="LAB">Laboratory</option><option value="SERVICE">Service</option><option value="PURCHASE">Purchase</option><option value="EXPENSE">Expenses</option></select></label>
      <label><span>Report Type</span><select value={reportType} onChange={(event) => setReportType(event.target.value)}><option>Details</option><option>Summary</option></select></label>
      <label><span>Doctor</span><select disabled defaultValue=""><option value="">All</option></select></label>
      <button className="transaction-search" type="submit">Search</button>
    </form>
    {error && <div className="transaction-error" role="alert">{error}<button onClick={() => void load()}>Retry</button></div>}
    <div className="transaction-table-wrap"><table className="transaction-table"><thead><tr><th>Date</th><th>Customer</th><th>Phone</th><th>Section</th><th>Payment Method</th><th>Account</th><th>User</th><th>Total Qty</th><th>Out</th><th>In</th><th>Balance</th><th>Action</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={12} className="transaction-empty">Loading transactions…</td></tr> : !shown.length ? <tr><td colSpan={12} className="transaction-empty">Muddadan wax transaction ah lama diiwaangelin.</td></tr> : shown.map((entry) => <tr key={`${entry.section}-${entry.id}`}><td>{new Date(entry.date).toLocaleString()}</td><td className="transaction-name">{entry.customer}</td><td>{entry.phone}</td><td>{entry.section}</td><td>{entry.paymentMethod}</td><td>{entry.account}</td><td>{entry.user}</td><td>{entry.quantity}</td><td>{entry.out ? currency(entry.out, entry.currency) : "0.00"}</td><td>{entry.in ? currency(entry.in, entry.currency) : "0.00"}</td><td className={entry.balance < 0 ? "transaction-negative" : ""}>{currency(entry.balance)}</td><td><button className="transaction-action" onClick={() => setSelected(entry)}>Details</button></td></tr>)}
      {!loading && shown.length > 0 && <tr className="transaction-total"><td colSpan={7}>Total:</td><td>{shown.reduce((sum, row) => sum + row.quantity, 0)}</td><td>{sumByCurrency(shown, "out")}</td><td>{sumByCurrency(shown, "in")}</td><td>{currency(shown[0]?.balance ?? 0, shown[0]?.currency)}</td><td /></tr>}
    </tbody></table></div>
  </section>
  {selected && <div className="transaction-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="transaction-modal" role="dialog" aria-modal="true"><header><div><small>TRANSACTION DETAILS</small><h2>{selected.customer}</h2></div><button onClick={() => setSelected(null)} aria-label="Close">×</button></header><dl><dt>Date</dt><dd>{new Date(selected.date).toLocaleString()}</dd><dt>Section</dt><dd>{selected.section}</dd><dt>Items</dt><dd>{selected.details || "—"}</dd><dt>Quantity</dt><dd>{selected.quantity}</dd><dt>Payment method</dt><dd>{selected.paymentMethod}</dd><dt>Out / In</dt><dd>{currency(selected.out, selected.currency)} / {currency(selected.in, selected.currency)}</dd></dl></section></div>}
  </div>;
}
