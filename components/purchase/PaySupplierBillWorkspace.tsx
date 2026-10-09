"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

type Supplier = { id: string; name: string; phone?: string | null };
type Bill = { id: string; invoiceNo?: string | null; createdAt: string; total: number | string; paidAmount: number | string; discount: number | string; balance: number; supplier?: Supplier | null; items: { id: string; quantity: number; costPrice: number | string; product: { name: string } }[] };
type Option = { id: string; name?: string; method?: string; currency?: string };
const fmt = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** Search a supplier's outstanding invoices and record payment against a selected bill. */
export default function PaySupplierBillWorkspace() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]); const [bills, setBills] = useState<Bill[]>([]); const [methods, setMethods] = useState<Option[]>([]); const [accounts, setAccounts] = useState<Option[]>([]); const [supplierId, setSupplierId] = useState("");
  const [selectedId, setSelectedId] = useState(""); const [expandedId, setExpandedId] = useState(""); const [paidAmount, setPaidAmount] = useState(""); const [paymentMethod, setPaymentMethod] = useState(""); const [accountId, setAccountId] = useState(""); const [paymentDate, setPaymentDate] = useState(localDate); const [note, setNote] = useState(""); const [loading, setLoading] = useState(false); const [saving, setSaving] = useState(false); const [message, setMessage] = useState("");
  useEffect(() => {
    Promise.all(["/api/purchase/suppliers", "/api/setup/payment-methods", "/api/setup/accounts"].map((url) => fetch(url).then((r) => r.ok ? r.json() : null)))
      .then(([supplierData, methodData, accountData]) => { setSuppliers(supplierData?.data ?? []); setMethods(methodData?.data ?? []); setAccounts(accountData?.data ?? []); })
      .catch(() => setMessage("Could not load supplier or account data."));
  }, []);
  const loadBills = useCallback(async () => {
    if (!supplierId) { setBills([]); setSelectedId(""); return; }
    setLoading(true); setMessage("");
    try { const response = await fetch(`/api/purchase/bill-report?supplierId=${encodeURIComponent(supplierId)}`, { cache: "no-store" }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Could not load invoices"); const list: Bill[] = payload.data ?? []; setBills(list); setSelectedId((old) => list.some((bill) => bill.id === old) ? old : ""); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Could not load invoices"); }
    finally { setLoading(false); }
  }, [supplierId]);
  useEffect(() => { void loadBills(); }, [loadBills]);
  const supplier = suppliers.find((item) => item.id === supplierId); const selected = bills.find((bill) => bill.id === selectedId) ?? null;
  const totals = useMemo(() => bills.reduce((sum, bill) => ({ total: sum.total + Number(bill.total), paid: sum.paid + Number(bill.paidAmount), discount: sum.discount + Number(bill.discount), balance: sum.balance + bill.balance }), { total: 0, paid: 0, discount: 0, balance: 0 }), [bills]);
  const payment = Number(paidAmount) || 0; const remaining = selected ? Math.max(0, selected.balance - payment) : 0;
  function chooseBill(bill: Bill) { setSelectedId(bill.id); setPaidAmount(String(bill.balance)); setMessage(""); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setMessage(""); if (!selected) { setMessage("Choose an invoice using its Details button first."); return; }
    if (payment <= 0 || payment > selected.balance) { setMessage("Enter a payment greater than zero and no higher than the invoice balance."); return; }
    setSaving(true);
    try { const response = await fetch("/api/purchase/pay-bill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purchaseId: selected.id, amount: payment, paymentMethod, accountId, paymentDate, note }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Payment could not be saved"); setMessage("Supplier payment saved."); setPaidAmount(""); setNote(""); setSelectedId(""); await loadBills(); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Payment could not be saved"); }
    finally { setSaving(false); }
  }
  return <main className="supplier-bill-page"><form className="supplier-bill-card" onSubmit={submit}>
    <h1>Search</h1>
    <div className="supplier-bill-search"><label>Search<select value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setSelectedId(""); setPaidAmount(""); }}><option value="">Select supplier</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}{item.phone ? ` - ${item.phone}` : ""}</option>)}</select></label><button type="button" onClick={() => void loadBills()}>Search</button></div>
    {supplier && <div className="supplier-bill-contact"><label>Name<output>{supplier.name}</output></label><label>Phone<output>{supplier.phone || "—"}</output></label></div>}
    {message && <p className="supplier-bill-message" role="status">{message}</p>}
    {supplierId && <><h2>Pending Invoices</h2><div className="supplier-bill-table-wrap"><table className="supplier-bill-table"><thead><tr><th>Date</th><th>User</th><th>Total</th><th>Paid</th><th>Discount</th><th>Balance</th><th>Action</th></tr></thead><tbody>{loading ? <tr><td colSpan={7} className="supplier-bill-empty">Loading invoices…</td></tr> : !bills.length ? <tr><td colSpan={7} className="supplier-bill-empty">No pending invoices found for this supplier.</td></tr> : bills.map((bill) => <Fragment key={bill.id}><tr className={selectedId === bill.id ? "selected" : ""}><td>{new Date(bill.createdAt).toLocaleString()}</td><td>—</td><td>{fmt(Number(bill.total))}</td><td>{fmt(Number(bill.paidAmount))}</td><td>{fmt(Number(bill.discount))}</td><td>{fmt(bill.balance)}</td><td><button type="button" onClick={() => { setExpandedId((old) => old === bill.id ? "" : bill.id); chooseBill(bill); }}>Details</button></td></tr>{expandedId === bill.id && <tr className="supplier-bill-detail"><td colSpan={7}><strong>Invoice {bill.invoiceNo || bill.id.slice(-7)}</strong><table><thead><tr><th>Product</th><th>Quantity</th><th>Cost price</th><th>Total</th></tr></thead><tbody>{bill.items.map((item) => <tr key={item.id}><td>{item.product.name}</td><td>{item.quantity}</td><td>{fmt(Number(item.costPrice))}</td><td>{fmt(item.quantity * Number(item.costPrice))}</td></tr>)}</tbody></table></td></tr>}</Fragment>)}</tbody>{bills.length > 0 && !loading && <tfoot><tr><th>Total:</th><th></th><th>{fmt(totals.total)}</th><th>{fmt(totals.paid)}</th><th>{fmt(totals.discount)}</th><th>{fmt(totals.balance)}</th><th></th></tr></tfoot>}</table></div>
    <div className="supplier-bill-payment"><label>Paid Amount<input type="number" min="0.01" max={selected?.balance} step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} /></label><label>Discount<output>{fmt(selected ? Number(selected.discount) : totals.discount)}</output></label><label>Balance<output className="balance">{fmt(remaining)}</output></label><label>Payment Method<select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}><option value="">Select</option>{methods.map((method) => <option key={method.id} value={method.name ?? method.method ?? ""}>{method.name ?? method.method ?? "Payment method"}</option>)}{!methods.length && <><option>Cash</option><option>Zaad</option><option>EVC Plus</option></>}</select></label><label>Accounts<select value={accountId} onChange={(e) => setAccountId(e.target.value)}><option value="">Select</option>{accounts.map((item) => <option key={item.id} value={item.id}>{item.name ?? item.currency ?? "Account"}</option>)}</select></label><label>Date<input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></label><label className="note">Note<input value={note} onChange={(e) => setNote(e.target.value)} /></label></div>
    <button className="supplier-bill-confirm" disabled={saving || loading || !bills.length}>{saving ? "Saving…" : "Confirm"}</button></>}
  </form></main>;
}
