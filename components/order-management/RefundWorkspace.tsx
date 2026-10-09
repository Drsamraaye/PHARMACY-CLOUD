"use client";

import { useEffect, useMemo, useState } from "react";

type SaleLine = { productId: string; name: string; soldQuantity: number; returnedQuantity: number; unitPrice: number };
type RefundSale = { id: string; date: string; total: number; paidAmount: number; refundedAmount: number; refundableAmount: number; patient: { id: string; fullName: string; phone: string | null } | null; items: SaleLine[] };
type Option = { id: string; name?: string; method?: string; currency?: string };
const fmt = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const customerKey = (sale: RefundSale) => sale.patient?.id || "walk-in";

export default function RefundWorkspace() {
  const [sales, setSales] = useState<RefundSale[]>([]); const [methods, setMethods] = useState<Option[]>([]); const [accounts, setAccounts] = useState<Option[]>([]);
  const [branchName, setBranchName] = useState("Branch"); const [customer, setCustomer] = useState(""); const [saleId, setSaleId] = useState(""); const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = useState(""); const [accountId, setAccountId] = useState(""); const [reason, setReason] = useState("Customer return"); const [notes, setNotes] = useState("");
  const [notice, setNotice] = useState(""); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetch("/api/order-management/refund").then((r) => r.ok ? r.json() : null), fetch("/api/setup/payment-methods").then((r) => r.ok ? r.json() : null), fetch("/api/setup/accounts").then((r) => r.ok ? r.json() : null), fetch("/api/setup/branches").then((r) => r.ok ? r.json() : null), fetch("/api/auth/session").then((r) => r.ok ? r.json() : null)])
      .then(([refunds, paymentList, accountList, branchList, session]) => {
        const data = refunds?.data ?? []; setSales(data); setMethods(paymentList?.data ?? []); setAccounts(accountList?.data ?? []);
        setBranchName(branchList?.data?.find((branch: Option) => branch.id === session?.data?.branchId)?.name ?? branchList?.data?.[0]?.name ?? "Branch");
        const first = data.find((sale: RefundSale) => sale.refundableAmount > 0 && sale.items.some((line) => line.soldQuantity > line.returnedQuantity));
        if (first) { setCustomer(customerKey(first)); setSaleId(first.id); }
      }).catch(() => setNotice("Refund data could not be loaded.")).finally(() => setLoading(false));
  }, []);

  const customers = useMemo(() => { const unique = new Map<string, string>(); for (const sale of sales) unique.set(customerKey(sale), sale.patient?.fullName ?? "Walk-in customer"); return [...unique].map(([id, name]) => ({ id, name })); }, [sales]);
  const customerSales = useMemo(() => sales.filter((sale) => customerKey(sale) === customer), [sales, customer]);
  const selectedSale = sales.find((sale) => sale.id === saleId) ?? null;
  const selectedLines = selectedSale?.items.filter((line) => line.soldQuantity > line.returnedQuantity) ?? [];
  const refundAmount = selectedLines.reduce((sum, line) => sum + line.unitPrice * (quantities[line.productId] ?? 0), 0);
  const balance = selectedSale ? Math.max(0, selectedSale.refundableAmount - refundAmount) : 0;
  function chooseCustomer(value: string) { setCustomer(value); const next = sales.find((sale) => customerKey(sale) === value && sale.refundableAmount > 0 && sale.items.some((line) => line.soldQuantity > line.returnedQuantity)); setSaleId(next?.id ?? ""); setQuantities({}); }
  function setQuantity(productId: string, value: number, line: SaleLine) { setQuantities((old) => ({ ...old, [productId]: Math.max(0, Math.min(line.soldQuantity - line.returnedQuantity, value || 0)) })); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setNotice("");
    if (!selectedSale || refundAmount <= 0) { setNotice("Choose a sale and enter a return quantity first."); return; }
    if (refundAmount > selectedSale.refundableAmount) { setNotice("Refund amount exceeds the remaining refundable balance."); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/order-management/refund", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ saleId: selectedSale.id, amount: refundAmount, reason, paymentMethod, accountId, notes, items: selectedLines.filter((line) => (quantities[line.productId] ?? 0) > 0).map((line) => ({ productId: line.productId, quantity: quantities[line.productId] })) }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Refund could not be processed.");
      setNotice("Refund successfully recorded."); setQuantities({}); const fresh = await fetch("/api/order-management/refund", { cache: "no-store" }).then((r) => r.json()); setSales(fresh.data ?? []);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Refund could not be processed."); } finally { setSaving(false); }
  }

  return <div className="refund-page"><form className="refund-card" onSubmit={submit}>
    <header className="refund-heading"><h1>Refund {branchName}</h1><span>{selectedSale ? `Sale · ${new Date(selectedSale.date).toLocaleDateString()}` : "Select a completed sale"}</span></header>
    <div className="refund-top-fields"><label className="refund-customer">Select Customer<select value={customer} onChange={(event) => chooseCustomer(event.target.value)}><option value="">Select Customer</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="refund-date">Date<input type="date" value={new Date().toISOString().slice(0, 10)} readOnly /></label></div>
    <label className="refund-sale-select">Sale<select value={saleId} onChange={(event) => { setSaleId(event.target.value); setQuantities({}); }} disabled={!customerSales.length}><option value="">Select sale</option>{customerSales.map((sale) => <option key={sale.id} value={sale.id}>{new Date(sale.date).toLocaleString()} · {fmt(sale.total)} · Refundable {fmt(sale.refundableAmount)}</option>)}</select></label>
    <div className="refund-product-table"><div className="refund-table-head"><span>Product</span><span>Stock</span><span>Quantity</span><span>Price</span><span>Total</span><span><span className="refund-add" aria-hidden="true">＋</span></span></div>
      {loading ? <div className="refund-no-items">Loading sales…</div> : selectedLines.length ? selectedLines.map((line) => { const quantity = quantities[line.productId] ?? 0; return <div className="refund-table-row" key={line.productId}><strong>{line.name}</strong><span>{line.soldQuantity - line.returnedQuantity}</span><input aria-label={`Return quantity for ${line.name}`} type="number" min="0" max={line.soldQuantity - line.returnedQuantity} value={quantity || ""} onChange={(event) => setQuantity(line.productId, Number(event.target.value), line)} placeholder="0"/><span>{fmt(line.unitPrice)}</span><output>{fmt(line.unitPrice * quantity)}</output><button className="refund-remove" type="button" aria-label={`Clear ${line.name} quantity`} onClick={() => setQuantity(line.productId, 0, line)}>−</button></div>; }) : <div className="refund-no-items">{selectedSale ? "This sale has no remaining refundable items." : "Select a customer and sale to see its products."}</div>}
    </div>
    <div className="refund-totals"><label>Total Amount<output>{fmt(refundAmount)}</output></label><label>Discount<input value="0.00" readOnly /></label><label>Final Total<output>{fmt(refundAmount)}</output></label><label>Paid<input value={fmt(refundAmount)} readOnly /></label><label>generalBalance<output className="refund-balance">{fmt(balance)}</output></label></div>
    <div className="refund-payment-fields"><label>Payment Method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="">Select</option>{methods.map((method) => <option key={method.id} value={method.name ?? method.method ?? ""}>{method.name ?? method.method ?? "Payment method"}</option>)}{!methods.length && <><option>Cash</option><option>Zaad</option><option>EVC Plus</option></>}</select></label><label>Accounts<select value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Select</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name ?? account.currency ?? "Account"}</option>)}</select></label><label>Note<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Faahfaahin halkan…" /></label></div>
    <label className="refund-reason">Reason<input required minLength={2} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
    {notice && <p className="refund-notice" role="status">{notice}</p>}<button className="refund-confirm" disabled={saving || loading}>{saving ? "Saving…" : "Confirm"}</button>
  </form></div>;
}
