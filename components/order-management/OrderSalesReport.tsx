"use client";

import { useCallback, useEffect, useState } from "react";

type Order = { id: string; date: string; customerId: string | null; customer: string; phone: string; type: string; totalQuantity: number; discount: number; paid: number; total: number; balance: number; status: string; paymentMethod: string; items: { id: string; name: string; quantity: number; price: number; total: number }[] };
type Payload = { data: Order[]; options: { patients: { id: string; fullName: string }[]; paymentMethods: { method: string; amount: number }[]; total: number; paid: number; balance: number } };
const dateString = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
const fmt = (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function OrderSalesReport() {
  const today = dateString(new Date());
  const [from, setFrom] = useState(today); const [to, setTo] = useState(today); const [customerId, setCustomerId] = useState(""); const [balanceFilter, setBalanceFilter] = useState("ALL"); const [orderType, setOrderType] = useState("ALL");
  const [payload, setPayload] = useState<Payload | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [expanded, setExpanded] = useState<string[]>([]);
  const load = useCallback(async () => { setLoading(true); setError(""); setExpanded([]); try { const params = new URLSearchParams({ from, to, customerId, balance: balanceFilter, orderType }); const response = await fetch(`/api/order-management/order-details-report?${params}`, { cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Warbixinta iibka lama soo rari karin."); setPayload(result); } catch (cause) { setError(cause instanceof Error ? cause.message : "Warbixinta iibka lama soo rari karin."); } finally { setLoading(false); } }, [from, to, customerId, balanceFilter, orderType]);
  useEffect(() => { void load(); }, [load]);
  function toggle(id: string) { setExpanded((old) => old.includes(id) ? old.filter((value) => value !== id) : [...old, id]); }
  return <div className="order-report-page"><section className="order-report-card">
    <header className="order-report-heading"><h1>Order Sales Report</h1><span>USD · Branch report</span></header>
    <form className="order-report-filters" onSubmit={(event) => { event.preventDefault(); void load(); }}>
      <label><span>▦ Date Range</span><div><input aria-label="From date" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /><b>–</b><input aria-label="To date" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></div></label>
      <label><span>♟ Customer</span><select value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">-- All Customers --</option>{payload?.options.patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.fullName}</option>)}</select></label>
      <label><span>▤ Balance Filter</span><select value={balanceFilter} onChange={(event) => setBalanceFilter(event.target.value)}><option value="ALL">All</option><option value="PAID">Paid</option><option value="DUE">Outstanding</option></select></label>
      <label><span>◉ Currency</span><select value="USD" disabled><option>USD</option></select></label>
      <label><span>Order Type</span><select value={orderType} onChange={(event) => setOrderType(event.target.value)}><option value="ALL">All</option><option value="PHARMACY">Pharmacy</option><option value="LAB">Laboratory</option><option value="SERVICE">Service</option></select></label>
      <button className="order-report-filter-button" type="submit">⚑ Filter</button>
    </form>
    <h2 className="order-report-summary-title">Wadarta Iibka (USD)</h2>
    <div className="order-report-kpis"><Metric label="TOTAL SALES" value={fmt(payload?.options.total ?? 0)} color="green"/><Metric label="TOTAL PAID" value={fmt(payload?.options.paid ?? 0)} color="green"/><Metric label="OUTSTANDING BALANCE" value={fmt(payload?.options.balance ?? 0)} color="blue"/>{payload?.options.paymentMethods.slice(0, 3).map((item) => <Metric key={item.method} label={item.method.toUpperCase()} value={fmt(item.amount)} color={item.method.toLowerCase().includes("cash") ? "orange" : "blue"}/>)}</div>
    <p className="order-report-currency-note">Lacagaha iibka waxaa database-ku ku kaydiyaa USD. Kala-qaybin Shilling/EVC/Zaad ah lama soo bandhigayo haddii aan si gooni ah loo kaydin.</p>
    {error && <div className="order-report-error" role="alert">{error}<button onClick={() => void load()}>Retry</button></div>}
    <div className="order-report-table-wrap"><table className="order-report-table"><thead><tr><th>#</th><th>Date</th><th>Name</th><th>Phone</th><th>Section</th><th>Type</th><th>Total Qty</th><th>Discount</th><th>Paid</th><th>Total</th><th>Balance</th><th>Details</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={12} className="order-report-empty">Warbixinta waa la soo rariyaa…</td></tr> : !payload?.data.length ? <tr><td colSpan={12} className="order-report-empty">Taariikhda iyo filters-kan wax iib ah lagama helin.</td></tr> : payload.data.map((order, index) => <FragmentRow key={order.id} order={order} index={index + 1} open={expanded.includes(order.id)} onToggle={() => toggle(order.id)}/>)}
    </tbody></table></div>
  </section></div>;
}
function Metric({ label, value, color }: { label: string; value: string; color: string }) { return <article className={`order-report-metric ${color}`}><small>{label}</small><strong>{value}</strong></article>; }
function FragmentRow({ order, index, open, onToggle }: { order: Order; index: number; open: boolean; onToggle: () => void }) {
  const section = order.type === "PHARMACY" ? "Pharmacy" : order.type === "LAB" ? "Laboratory" : "Service";
  return <><tr><td>{index}</td><td>{new Date(order.date).toLocaleString()}</td><td className="order-report-name">{order.customer}</td><td>{order.phone}</td><td>{section}</td><td><span className="order-report-type">Order</span></td><td>{order.totalQuantity.toFixed(2)}</td><td>{fmt(order.discount)}</td><td>{fmt(order.paid)}</td><td>{fmt(order.total)}</td><td>{fmt(order.balance)}</td><td><button className="order-report-detail-button" onClick={onToggle}>{open ? "Hide details" : "View details"}</button></td></tr>{open && <tr className="order-expanded-row"><td colSpan={12}><div className="order-expanded-card"><table><thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>{order.items.map((item, line) => <tr key={item.id}><td>{line + 1}</td><td>{item.name}</td><td>{item.quantity}</td><td>{fmt(item.price)}</td><td>{fmt(item.total)}</td></tr>)}</tbody><tfoot><tr><td colSpan={4}>Sub Total</td><td>{fmt(order.items.reduce((sum, item) => sum + item.total, 0))}</td></tr></tfoot></table><div className="order-payment-breakdown"><h3>Payment Breakdown</h3><div><span>{order.paymentMethod}</span><strong>{fmt(order.paid)}</strong><span>Balance due</span><strong>{fmt(order.balance)}</strong></div></div></div></td></tr>}</>;
}
