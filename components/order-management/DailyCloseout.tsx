"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Expense = { id: string; description?: string; type?: string; amount?: number | string; currency?: string; createdAt: string };
type CloseoutData = { date: string; sales: number; cashIn: number; discounts: number; expenses: Expense[]; expenseTotal: number; net: number; transactions: number; paymentSummary: { method: string; amount: number; transactions: number }[]; accounts: { id: string; name: string; currency: string; balance: number }[]; reconciliations: { id: string; date: string; expectedCash: number; countedCash: number; difference: number; notes?: string; createdAt: string }[] };
const localDate = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; };
const money = (value: number, currency = "USD") => `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${/^[A-Z]{3}$/.test(currency) ? currency : "USD"}`;

export default function DailyCloseout() {
  const [date, setDate] = useState(localDate());
  const [data, setData] = useState<CloseoutData | null>(null);
  const [countedCash, setCountedCash] = useState("");
  const [notes, setNotes] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { const response = await fetch(`/api/order-management/xisaab-xidh?date=${date}`, { cache: "no-store" }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Warbixinta lama soo rari karin."); setData(payload.data); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Warbixinta lama soo rari karin."); }
    finally { setLoading(false); }
  }, [date]);
  useEffect(() => { void load(); }, [load]);
  async function closeDay(event: FormEvent) {
    event.preventDefault(); setSaving(true); setNotice("");
    try { const response = await fetch("/api/order-management/xisaab-xidh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, countedCash: Number(countedCash), notes }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Xisaab-xirku ma kaydsamin."); setNotice("Xisaab-xirka maalinta waa la kaydiyey."); setCountedCash(""); await load(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Xisaab-xirku ma kaydsamin."); }
    finally { setSaving(false); }
  }
  return <div className="closeout-page">
    <section className="closeout-report">
      <header className="closeout-report-heading"><div><span className="closeout-eyebrow">FINANCE · DAILY CONTROL</span><h1>Transaction Summary Report</h1><p>Hubi iibka, kharashaadka iyo lacagta maalinta.</p></div><label className="closeout-date-filter">Date range<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label></header>
      <div className="closeout-filter-row"><div className="closeout-filter"><span>Branch</span><strong>Active branch</strong></div><div className="closeout-filter"><span>Transactions</span><strong>{data?.transactions ?? 0}</strong></div><div className="closeout-filter"><span>Payment method</span><strong>All methods</strong></div><div className="closeout-filter"><span>Report type</span><strong>Daily summary</strong></div></div>
      {notice && <p className="closeout-notice" role="status">{notice}</p>}
      <div className="closeout-kpis"><Metric title="Dakhli (Sales)" value={loading ? "…" : money(data?.sales ?? 0)} color="green"/><Metric title="Lacag la qabtay" value={loading ? "…" : money(data?.cashIn ?? 0)} color="red"/><Metric title="Kharashyada" value={loading ? "…" : money(data?.expenseTotal ?? 0)} color="orange"/><Metric title="Net" value={loading ? "…" : money(data?.net ?? 0)} color="violet"/></div>
      <section className="closeout-table-card"><div className="closeout-section-heading"><h2>Faahfaahinta dakhliga &amp; kharashka</h2></div><div className="closeout-detail-columns"><div><h3 className="income-heading">DAKHLIGA (INCOME)</h3><div className="closeout-detail-row"><span>Iibka guud</span><strong>{money(data?.sales ?? 0)}</strong></div><div className="closeout-detail-row"><span>Lacag la qabtay</span><strong>{money(data?.cashIn ?? 0)}</strong></div><div className="closeout-detail-row"><span>Discount</span><strong>{money(data?.discounts ?? 0)}</strong></div></div><div><h3 className="expense-heading">KHARASH (EXPENSES)</h3>{data?.expenses.length ? data.expenses.map((expense) => <div className="closeout-detail-row" key={expense.id}><span>{expense.description || expense.type || "Expense"}</span><strong>{money(Number(expense.amount ?? 0), expense.currency || "USD")}</strong></div>) : <div className="closeout-detail-row"><span>Wax kharash ah lama diiwaangelin.</span><strong>{money(0)}</strong></div>}<div className="closeout-detail-row closeout-subtotal"><span>Wadarta kharashka (USD)</span><strong>{money(data?.expenseTotal ?? 0)}</strong></div></div></div></section>
      <div className="closeout-lower-grid"><section className="closeout-table-card"><div className="closeout-section-heading blue"><h2>Faahfaahinta lacagaha la qabtay</h2></div><div className="closeout-table-scroll"><table className="closeout-table"><thead><tr><th>Habka lacagta</th><th>Macaamillada</th><th>Lacagta</th></tr></thead><tbody>{data?.paymentSummary.length ? data.paymentSummary.map((row) => <tr key={row.method}><td>{row.method}</td><td>{row.transactions}</td><td className="amount">{money(row.amount)}</td></tr>) : <tr><td colSpan={3} className="closeout-empty">Weli lacag-bixin lama diiwaangelin.</td></tr>}</tbody></table></div></section>
        <section className="closeout-table-card"><div className="closeout-section-heading violet"><h2>Koontooyinka firfircoon</h2></div><div className="closeout-account-grid">{data?.accounts.length ? data.accounts.map((account) => <div className="closeout-account" key={account.id}><span>{account.name} · {account.currency}</span><strong>{money(account.balance, account.currency)}</strong></div>) : <p className="closeout-empty">Koontooyin lama diiwaangelin.</p>}</div></section></div>
      <section className="closeout-history"><div className="closeout-section-heading"><h2>Xisaab-xiradii hore</h2></div><div className="closeout-table-scroll"><table className="closeout-table"><thead><tr><th>Taariikh</th><th>Lacag la filayey</th><th>Lacag la tiriyey</th><th>Farqiga</th><th>Faallo</th></tr></thead><tbody>{data?.reconciliations.length ? data.reconciliations.map((row) => <tr key={row.id}><td>{row.date}</td><td>{money(Number(row.expectedCash))}</td><td>{money(Number(row.countedCash))}</td><td className={Number(row.difference) < 0 ? "amount" : "positive-amount"}>{money(Number(row.difference))}</td><td>{row.notes || "—"}</td></tr>) : <tr><td colSpan={5} className="closeout-empty">Maalintan wali xisaab-xir lama samayn.</td></tr>}</tbody></table></div></section>
      <form className="closeout-form" onSubmit={closeDay}><div className="closeout-form-heading"><span>⛨</span><h2>WARbixinta XISAABTA</h2></div><div className="closeout-form-content"><div className="closeout-net-banner"><small>LACAGTA LA SHUBAY</small><strong>{money(data?.net ?? 0)}</strong></div><label className="closeout-counted">Lacagta la tiriyey<input required min="0" step="0.01" type="number" value={countedCash} onChange={(event) => setCountedCash(event.target.value)} placeholder="Geli lacagta la tiriyey" /></label><label className="closeout-notes">Notes / Faahfaahin dheeraad ah<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Qor halkan…" /></label><label className="closeout-date-field">Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><button className="closeout-confirm" disabled={saving}>{saving ? "Waa la kaydinayaa…" : "Confirm"}</button></div></form>
    </section>
  </div>;
}
function Metric({ title, value, color }: { title: string; value: string; color: string }) { return <article className={`closeout-metric ${color}`}><span>{title}</span><strong>{value}</strong></article>; }
