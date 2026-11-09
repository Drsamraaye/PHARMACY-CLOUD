"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Method = "Cash Shilling" | "Cash Dollar" | "Zaad Shilling" | "Zaad Dollar";
type Balances = Record<Method, number>;
type Expense = { id: string; description?: string; type?: string; amount: number; currency: string; user: string; createdAt: string };
type HistoryRow = { id: string; businessDate: string; closedAt: string; closedBy: string; status: string; notes?: string | null; exchangeRate: number } & Record<string, number | string | null | undefined>;
type Data = { date: string; sales: number; grossSalesUsd: number; salesSLShEquivalent: number; cashIn: number; discounts: number; refunds: number; creditNotes: number; outstandingDebt: number; expenseTotal: number; costOfGoodsUsd: number; costDataGaps: number; net: number; transactions: number; exchangeRate: number | null; expected: Balances; paymentSummary: { method: Method; amount: number; transactions: number; currency: string }[]; expenses: Expense[]; reconciliations: HistoryRow[] };
const methods: { name: Method; expected: keyof Balances; actual: string; difference: string; currency: string }[] = [
  { name: "Cash Shilling", expected: "Cash Shilling", actual: "actualCashSLSh", difference: "differenceCashSLSh", currency: "SLSh" },
  { name: "Cash Dollar", expected: "Cash Dollar", actual: "actualCashUSD", difference: "differenceCashUSD", currency: "USD" },
  { name: "Zaad Shilling", expected: "Zaad Shilling", actual: "actualZaadSLSh", difference: "differenceZaadSLSh", currency: "SLSh" },
  { name: "Zaad Dollar", expected: "Zaad Dollar", actual: "actualZaadUSD", difference: "differenceZaadUSD", currency: "USD" },
];
const localDate = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; };
const money = (value: number, currency = "USD") => `${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
const blankActual = () => ({ actualCashSLSh: "", actualCashUSD: "", actualZaadSLSh: "", actualZaadUSD: "" });

export default function DailyCloseout() {
  const [date, setDate] = useState(localDate());
  const [data, setData] = useState<Data | null>(null);
  const [actual, setActual] = useState(blankActual());
  const [notes, setNotes] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const existing = useMemo(() => data?.reconciliations?.[0] ?? null, [data]);
  const load = useCallback(async () => {
    setLoading(true); setNotice("");
    try { const response = await fetch(`/api/order-management/xisaab-xidh?date=${date}`, { cache: "no-store" }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Warbixinta lama soo rari karin."); setData(payload.data); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Warbixinta lama soo rari karin."); }
    finally { setLoading(false); }
  }, [date]);
  useEffect(() => { void load(); }, [load]);
  async function closeDay(event: FormEvent) {
    event.preventDefault(); setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/order-management/xisaab-xidh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, ...Object.fromEntries(Object.entries(actual).map(([key, value]) => [key, Number(value)])), notes }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Xisaab-xirku ma kaydsamin.");
      setNotice(payload.data.status === "DISCREPANCY" ? "Xisaab-xirka waa la dhammeystiray. Maamulayaasha waa la ogeysiiyey." : "Xisaab-xirka waa la dhammeystiray, dhammaan xisaabaadkuna way isu dheellitiran yihiin.");
      setActual(blankActual()); setNotes(""); await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Xisaab-xirku ma kaydsamin."); }
    finally { setSaving(false); }
  }
  const shortageSLSh = methods.filter((m) => m.currency === "SLSh").reduce((sum, m) => sum + Math.max(0, -Number(existing?.[m.difference] ?? 0)), 0);
  const excessSLSh = methods.filter((m) => m.currency === "SLSh").reduce((sum, m) => sum + Math.max(0, Number(existing?.[m.difference] ?? 0)), 0);
  const shortageUSD = methods.filter((m) => m.currency === "USD").reduce((sum, m) => sum + Math.max(0, -Number(existing?.[m.difference] ?? 0)), 0);
  const excessUSD = methods.filter((m) => m.currency === "USD").reduce((sum, m) => sum + Math.max(0, Number(existing?.[m.difference] ?? 0)), 0);
  return <div className="closeout-page"><section className="closeout-report">
    <header className="closeout-report-heading"><div><span className="closeout-eyebrow">FINANCE · DAILY CONTROL</span><h1>Daily Transaction Summary &amp; Closeout</h1><p>Revenue, cash collected, debt and physical balances are reported separately.</p></div><label className="closeout-date-filter">Business date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label></header>
    {notice && <p className="closeout-notice" role="status">{notice}</p>}
    <div className="closeout-filter-row"><div className="closeout-filter"><span>Branch</span><strong>Active branch</strong></div><div className="closeout-filter"><span>Transactions</span><strong>{data?.transactions ?? 0}</strong></div><div className="closeout-filter"><span>Exchange rate</span><strong>{data?.exchangeRate ? `1 USD = ${data.exchangeRate.toLocaleString()} SLSh` : "Not set"}</strong></div><div className="closeout-filter"><span>Closeout status</span><strong>{loading ? "Loading…" : existing?.status ?? "Open"}</strong></div></div>
    {!!data?.costDataGaps && <p className="closeout-notice">Profit excludes {data.costDataGaps} item line(s) without a stored historical cost snapshot. Older sales were left unchanged.</p>}
    <div className="closeout-kpis"><Metric title="Sales · USD equivalent" value={loading ? "…" : money(data?.sales ?? 0)} color="green"/><Metric title="Received · USD equivalent" value={loading ? "…" : money(data?.cashIn ?? 0)} color="red"/><Metric title="Customer debt" value={loading ? "…" : money(data?.outstandingDebt ?? 0)} color="orange"/><Metric title="Net profit estimate · USD" value={loading ? "…" : money(data?.net ?? 0)} color="violet"/></div>
    <section className="closeout-table-card"><div className="closeout-section-heading"><h2>Sales summary</h2></div><div className="closeout-detail-columns"><div><h3 className="income-heading">REVENUE &amp; RECEIPTS</h3><SummaryRow label="Gross sales (USD)" value={money(data?.grossSalesUsd ?? 0)} /><SummaryRow label="Sales after discounts (USD)" value={money(data?.sales ?? 0)} /><SummaryRow label="Sales equivalent (SLSh)" value={money(data?.salesSLShEquivalent ?? 0, "SLSh")} /><SummaryRow label="Cash collected (USD eq.)" value={money(data?.cashIn ?? 0)} /><SummaryRow label="Outstanding customer debt" value={money(data?.outstandingDebt ?? 0)} /></div><div><h3 className="expense-heading">ADJUSTMENTS &amp; EXPENSES</h3><SummaryRow label="Discounts (USD)" value={money(data?.discounts ?? 0)} /><SummaryRow label="Refunds to patients (USD)" value={money(data?.refunds ?? 0)} /><SummaryRow label="Credit notes · pharmacy returns (USD)" value={money(data?.creditNotes ?? 0)} /><SummaryRow label="Cost of goods sold (USD)" value={money(data?.costOfGoodsUsd ?? 0)} /><SummaryRow label="Expenses (USD)" value={money(data?.expenseTotal ?? 0)} /><SummaryRow label="Net profit · USD equivalent" value={money(data?.net ?? 0)} /></div></div></section>
    <div className="closeout-lower-grid"><section className="closeout-table-card"><div className="closeout-section-heading blue"><h2>Payment method totals</h2></div><div className="closeout-table-scroll"><table className="closeout-table"><thead><tr><th>Method</th><th>Transactions</th><th>Original currency total</th></tr></thead><tbody>{data?.paymentSummary.map((row) => <tr key={row.method}><td>{row.method}</td><td>{row.transactions}</td><td className="amount">{money(row.amount, row.currency)}</td></tr>)}</tbody></table></div></section>
      <section className="closeout-table-card"><div className="closeout-section-heading violet"><h2>Expense details · USD</h2></div><div className="closeout-table-scroll"><table className="closeout-table"><thead><tr><th>Description</th><th>Date</th><th>User</th><th>Amount</th></tr></thead><tbody>{data?.expenses.length ? data.expenses.map((expense) => <tr key={expense.id}><td>{expense.description || expense.type || "Expense"}</td><td>{new Date(expense.createdAt).toLocaleDateString()}</td><td>{expense.user}</td><td>{money(expense.amount, expense.currency)}</td></tr>) : <tr><td colSpan={4} className="closeout-empty">No expenses recorded.</td></tr>}</tbody></table></div></section></div>
    {existing && <section className="closeout-history"><div className="closeout-section-heading"><h2>Finalized closeout · {existing.status}</h2></div><div className="closeout-table-scroll"><table className="closeout-table"><thead><tr><th>Payment method</th><th>Expected</th><th>Actual</th><th>Difference</th></tr></thead><tbody>{methods.map((method) => <tr key={method.name}><td>{method.name}</td><td>{money(Number(existing[`expected${method.name === "Cash Shilling" ? "CashSLSh" : method.name === "Cash Dollar" ? "CashUSD" : method.name === "Zaad Shilling" ? "ZaadSLSh" : "ZaadUSD"}`] ?? 0), method.currency)}</td><td>{money(Number(existing[method.actual] ?? 0), method.currency)}</td><td className={Number(existing[method.difference] ?? 0) < 0 ? "amount" : "positive-amount"}>{money(Number(existing[method.difference] ?? 0), method.currency)}</td></tr>)}</tbody></table></div><div className="closeout-detail-columns"><div><SummaryRow label="SLSh shortages / excess" value={`${money(shortageSLSh, "SLSh")} / ${money(excessSLSh, "SLSh")}`} /><SummaryRow label="USD shortages / excess" value={`${money(shortageUSD)} / ${money(excessUSD)}`} /></div><div><SummaryRow label="Rate snapshot" value={`1 USD = ${Number(existing.exchangeRate).toLocaleString()} SLSh`} /><SummaryRow label="USD equivalent of actual balances" value={money((Number(existing.actualCashUSD) + Number(existing.actualZaadUSD)) + (Number(existing.actualCashSLSh) + Number(existing.actualZaadSLSh)) / Number(existing.exchangeRate))} /><SummaryRow label="Closed at" value={new Date(existing.closedAt).toLocaleString()} /><SummaryRow label="Notes" value={existing.notes || "—"} /></div></div></section>}
    {!existing && <form className="closeout-form" onSubmit={closeDay}><div className="closeout-form-heading"><span>⛨</span><h2>New closeout · actual count</h2></div><div className="closeout-form-content"><p>Enter the physical cash and Zaad balances yourself. Each payment channel is reconciled independently.</p><div className="closeout-account-grid">{methods.map((method) => <label className="closeout-counted" key={method.name}>{method.name} ({method.currency})<input required min="0" step="0.01" type="number" value={actual[method.actual as keyof typeof actual]} onChange={(event) => setActual((old) => ({ ...old, [method.actual]: event.target.value }))} placeholder="Enter actual amount" /></label>)}</div><label className="closeout-notes">Discrepancy note / explanation<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Required only if actual balances differ from expected." /></label><button className="closeout-confirm" disabled={saving}>{saving ? "Finalizing…" : "Finalize closeout"}</button></div></form>}
    <section className="closeout-history"><div className="closeout-section-heading"><h2>Closeout history</h2></div><div className="closeout-table-scroll"><table className="closeout-table"><thead><tr><th>Business date</th><th>Status</th><th>Closed at</th><th>Cash SLSh</th><th>Cash USD</th><th>Zaad SLSh</th><th>Zaad USD</th><th>Notes</th></tr></thead><tbody>{data?.reconciliations.length ? data.reconciliations.map((row) => <tr key={row.id}><td>{row.businessDate}</td><td>{row.status}</td><td>{new Date(row.closedAt).toLocaleString()}</td><td>{money(Number(row.actualCashSLSh), "SLSh")}</td><td>{money(Number(row.actualCashUSD))}</td><td>{money(Number(row.actualZaadSLSh), "SLSh")}</td><td>{money(Number(row.actualZaadUSD))}</td><td>{row.notes || "—"}</td></tr>) : <tr><td colSpan={8} className="closeout-empty">No finalized closeout for this business date.</td></tr>}</tbody></table></div></section>
  </section></div>;
}
function Metric({ title, value, color }: { title: string; value: string; color: string }) { return <article className={`closeout-metric ${color}`}><span>{title}</span><strong>{value}</strong></article>; }
function SummaryRow({ label, value }: { label: string; value: string }) { return <div className="closeout-detail-row"><span>{label}</span><strong>{value}</strong></div>; }
