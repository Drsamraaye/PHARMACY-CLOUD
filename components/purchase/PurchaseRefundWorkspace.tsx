"use client";

import { useEffect, useMemo, useState } from "react";

type Option = { id: string; name?: string; method?: string; currency?: string; phone?: string | null };
type PurchaseItem = { id: string; productId: string; quantity: number; costPrice: number | string; returnedQuantity: number; stock: number; product: { name: string } };
type Purchase = { id: string; invoiceNo?: string | null; createdAt: string; total: number | string; supplierId?: string | null; supplier?: Option | null; items: PurchaseItem[] };
const fmt = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; };

/** Supplier return form based on a selected purchase, with remaining quantity safeguards. */
export default function PurchaseRefundWorkspace() {
  const [suppliers, setSuppliers] = useState<Option[]>([]); const [purchases, setPurchases] = useState<Purchase[]>([]); const [methods, setMethods] = useState<Option[]>([]); const [accounts, setAccounts] = useState<Option[]>([]); const [branch, setBranch] = useState("Branch");
  const [supplierId, setSupplierId] = useState(""); const [purchaseId, setPurchaseId] = useState(""); const [quantities, setQuantities] = useState<Record<string, number>>({}); const [paymentMethod, setPaymentMethod] = useState(""); const [accountId, setAccountId] = useState(""); const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [notice, setNotice] = useState("");
  async function load() {
    setLoading(true);
    try {
      const [supplierData, refundData, methodData, accountData, branchData, sessionData] = await Promise.all(["/api/purchase/suppliers", "/api/purchase/refund", "/api/setup/payment-methods", "/api/setup/accounts", "/api/setup/branches", "/api/auth/session"].map((url) => fetch(url, { cache: "no-store" }).then((r) => r.ok ? r.json() : null)));
      const supplierList = supplierData?.data ?? []; const purchaseList: Purchase[] = refundData?.data ?? [];
      setSuppliers(supplierList); setPurchases(purchaseList); setMethods(methodData?.data ?? []); setAccounts(accountData?.data ?? []);
      setBranch(branchData?.data?.find((item: Option) => item.id === sessionData?.data?.branchId)?.name ?? branchData?.data?.[0]?.name ?? "Branch");
      const first = purchaseList.find((purchase) => purchase.items.some((item) => item.quantity > item.returnedQuantity));
      if (first) { setSupplierId(first.supplierId ?? ""); setPurchaseId(first.id); }
    } catch { setNotice("Refund data could not be loaded."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const supplierPurchases = useMemo(() => purchases.filter((purchase) => purchase.supplierId === supplierId && purchase.items.some((item) => item.quantity > item.returnedQuantity)), [purchases, supplierId]);
  const selectedPurchase = purchases.find((purchase) => purchase.id === purchaseId) ?? null;
  const lines = useMemo(() => {
    const grouped = new Map<string, PurchaseItem>();
    for (const item of selectedPurchase?.items ?? []) {
      const previous = grouped.get(item.productId);
      if (previous) { const quantity = previous.quantity + item.quantity; const returnedQuantity = previous.returnedQuantity + item.returnedQuantity; previous.costPrice = (Number(previous.costPrice) * previous.quantity + Number(item.costPrice) * item.quantity) / quantity; previous.quantity = quantity; previous.returnedQuantity = returnedQuantity; previous.stock = Math.max(previous.stock, item.stock); }
      else grouped.set(item.productId, { ...item });
    }
    return [...grouped.values()].filter((item) => item.quantity > item.returnedQuantity);
  }, [selectedPurchase]);
  const total = lines.reduce((sum, item) => sum + (quantities[item.productId] ?? 0) * Number(item.costPrice), 0);
  function chooseSupplier(id: string) { setSupplierId(id); const next = purchases.find((purchase) => purchase.supplierId === id && purchase.items.some((item) => item.quantity > item.returnedQuantity)); setPurchaseId(next?.id ?? ""); setQuantities({}); }
  function changeQty(item: PurchaseItem, value: number) { setQuantities((old) => ({ ...old, [item.productId]: Math.max(0, Math.min(item.quantity - item.returnedQuantity, item.stock, value || 0)) })); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setNotice(""); const items = lines.filter((item) => (quantities[item.productId] ?? 0) > 0).map((item) => ({ productId: item.productId, quantity: quantities[item.productId] }));
    if (!selectedPurchase || !items.length || total <= 0) { setNotice("Dooro purchase oo geli tirada alaabta la celinayo."); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/purchase/refund", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purchaseId: selectedPurchase.id, amount: total, reason: "Supplier return", paymentMethod, accountId, notes, items }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Return could not be processed.");
      setNotice("Refund successfully recorded."); setQuantities({}); await load();
    } catch (e) { setNotice(e instanceof Error ? e.message : "Return could not be processed."); }
    finally { setSaving(false); }
  }
  return <main className="refund-page"><form className="purchase-refund-card" onSubmit={submit}>
    <header className="purchase-refund-heading"><h1>Refund {branch}</h1></header>
    <div className="purchase-refund-top"><label>Select Supplier<select value={supplierId} onChange={(e) => chooseSupplier(e.target.value)}><option value="">Select Supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label><label>Date<input type="date" value={today()} readOnly /></label></div>
    <label className="purchase-refund-purchase">Purchase<select value={purchaseId} onChange={(e) => { setPurchaseId(e.target.value); setQuantities({}); }} disabled={!supplierPurchases.length}><option value="">Select purchase</option>{supplierPurchases.map((purchase) => <option key={purchase.id} value={purchase.id}>{purchase.invoiceNo || purchase.id.slice(-7)} · {new Date(purchase.createdAt).toLocaleString()} · {fmt(Number(purchase.total))}</option>)}</select></label>
    <div className="purchase-refund-table-wrap"><table className="purchase-refund-table"><thead><tr><th>Product</th><th>Stock</th><th>Quantity</th><th>Price</th><th>Total</th><th /></tr></thead><tbody>{loading ? <tr><td colSpan={6} className="purchase-refund-empty">Loading purchases…</td></tr> : lines.length ? lines.map((item) => { const qty = quantities[item.productId] ?? 0; return <tr key={item.id}><td>{item.product.name}</td><td><span>{item.stock}</span></td><td><input aria-label={`Return quantity ${item.product.name}`} type="number" min="0" max={Math.min(item.quantity - item.returnedQuantity, item.stock)} value={qty || ""} placeholder="0" onChange={(e) => changeQty(item, Number(e.target.value))} /></td><td>{fmt(Number(item.costPrice))}</td><td>{fmt(qty * Number(item.costPrice))}</td><td><button type="button" aria-label={`Clear ${item.product.name}`} onClick={() => changeQty(item, 0)}>−</button></td></tr>; }) : <tr><td colSpan={6} className="purchase-refund-empty">{selectedPurchase ? "All items in this purchase have already been returned." : "Select a supplier and purchase to see products."}</td></tr>}</tbody></table></div>
    <div className="purchase-refund-totals"><label>Total Amount<output>{fmt(total)}</output></label><label>Discount<output>0.00</output></label><label>Final Total<output>{fmt(total)}</output></label><label>Paid<output>{fmt(total)}</output></label><label>general.Balance<output className="balance">0.00</output></label></div>
    <div className="purchase-refund-bottom"><label>Payment Method<select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}><option value="">Select</option>{methods.map((method) => <option key={method.id} value={method.name ?? method.method ?? ""}>{method.name ?? method.method ?? "Payment method"}</option>)}{!methods.length && <><option>Cash</option><option>Zaad</option><option>EVC Plus</option></>}</select></label><label>Accounts<select value={accountId} onChange={(e) => setAccountId(e.target.value)}><option value="">Select</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name ?? account.currency ?? "Account"}</option>)}</select></label><label>Note<textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Faahfaahin halkan…" /></label></div>
    {notice && <p className="refund-notice" role="status">{notice}</p>}<button className="refund-confirm" disabled={saving || loading}>{saving ? "Saving…" : "Confirm"}</button>
  </form></main>;
}
