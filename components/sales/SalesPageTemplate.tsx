"use client";

import { useEffect, useMemo, useState } from "react";

type Product = { id: string; name: string; salePrice: number | string; costPrice?: number | string; quantity: number };
type Line = { productId: string; quantity: number };
type Patient = { id: string; fullName: string; phone?: string | null };
type SelectOption = { id: string; name?: string; method?: string; currency?: string };
const endpoints = { pharmacy: { type: "PHARMACY", sales: "/api/order-management/pharmacy-sales" }, lab: { type: "LAB", sales: "/api/order-management/laboratory-sales" }, service: { type: "SERVICE", sales: "/api/order-management/services-order" } };
const titles = { pharmacy: "Pharmacy Sales Page", lab: "Laboratory Sales Page", service: "Service Order Page" };
const format = (value: number) => value.toFixed(2);

/** Shared point-of-sale workflow styled to match the reference system's sales screen. */
export default function SalesPageTemplate({ type }: { type: "pharmacy" | "lab" | "service" }) {
  const config = endpoints[type];
  const [products, setProducts] = useState<Product[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<SelectOption[]>([]);
  const [accounts, setAccounts] = useState<SelectOption[]>([]);
  const [branchName, setBranchName] = useState("Branch");
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [lines, setLines] = useState<Line[]>([{ productId: "", quantity: 1 }]);
  const [patientId, setPatientId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    Promise.all([
      fetch(`/api/products?type=${config.type}`).then((r) => r.ok ? r.json() : null),
      fetch("/api/patients").then((r) => r.ok ? r.json() : null),
      fetch("/api/setup/payment-methods").then((r) => r.ok ? r.json() : null),
      fetch("/api/setup/accounts").then((r) => r.ok ? r.json() : null),
      fetch("/api/setup/branches").then((r) => r.ok ? r.json() : null),
      fetch("/api/auth/session").then((r) => r.ok ? r.json() : null),
    ]).then(([p, c, methods, accountList, branchList, session]) => {
      setProducts(p?.data ?? []); setPatients(c?.data ?? []); setPaymentMethods(methods?.data ?? []); setAccounts(accountList?.data ?? []);
      setBranchName(branchList?.data?.find((branch: SelectOption) => branch.id === session?.data?.branchId)?.name ?? branchList?.data?.[0]?.name ?? "Branch");
      setUserName(session?.data?.fullName ?? "");
      setUserRole(session?.data?.role ?? "");
    }).catch(() => setNotice("Xogta iibka lama soo rari karin. Dib u cusboonaysii bogga."));
  }, [config.type]);

  const subtotal = useMemo(() => lines.reduce((sum, line) => { const product = products.find((item) => item.id === line.productId); return sum + Number(product?.salePrice || 0) * line.quantity; }, 0), [lines, products]);
  const totalDue = Math.max(0, subtotal - discount);
  function update(index: number, patch: Partial<Line>) { setLines((existing) => existing.map((line, i) => i === index ? { ...line, ...patch } : line)); }
  async function addCustomer(event: React.FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      const response = await fetch("/api/patients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: customerName, phone: customerPhone }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Bukaanka lama diiwaangelin karin.");
      setPatients((all) => [...all, result.data]); setPatientId(result.data.id); setAddingCustomer(false); setCustomerName(""); setCustomerPhone(""); setNotice("Macmiilka cusub waa la diiwaangeliyey.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Macmiilka lama diiwaangelin karin."); } finally { setBusy(false); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setNotice("");
    const items = lines.filter((line) => line.productId && line.quantity > 0);
    if (!items.length) { setNotice("Dooro ugu yaraan hal alaab."); return; }
    const insufficient = items.find((line) => { const product = products.find((item) => item.id === line.productId); return type === "pharmacy" && line.quantity > Number(product?.quantity ?? 0); });
    if (insufficient) { setNotice(`Kaydka kuma filna: ${products.find((product) => product.id === insufficient.productId)?.name ?? "alaabta"}.`); return; }
    setBusy(true);
    try {
      const response = await fetch(config.sales, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId: patientId || null, discount, paidAmount, paymentMethod: paymentMethod || null, createdAt: new Date(`${saleDate}T12:00:00`).toISOString(), items }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Iibka lama kaydin karin.");
      setNotice("Iibka si guul leh ayaa loo diiwaangeliyey."); setLines([{ productId: "", quantity: 1 }]); setDiscount(0); setPaidAmount(0);
      const refreshed = await fetch(`/api/products?type=${config.type}`).then((r) => r.json()); setProducts(refreshed.data ?? []);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Iibka lama kaydin karin."); } finally { setBusy(false); }
  }

  const isPharmacist = userRole === "PHARMACIST";
  return <section className={`sales-page${isPharmacist ? " pharmacist-sales" : ""}`}>
    <form className="sales-workspace" onSubmit={submit}>
      <div className="sales-titlebar"><div className="sales-title-group"><h1>{titles[type]}</h1><span className="sales-chip">{branchName}</span>{userName && <span className="sales-user-chip">User: {userName}</span>}</div><div className="sales-header-actions"><button type="button" className="sales-pill-button" onClick={() => setAddingCustomer(true)}>＋ Add New Customer</button><button type="button" className="sales-pill-button" onClick={() => { setLines([{ productId: "", quantity: 1 }]); setPatientId(""); setDiscount(0); setPaidAmount(0); }}>＋ New Tab</button></div></div>
      <div className="sales-select-grid"><label>Select Customer<select value={patientId} onChange={(event) => setPatientId(event.target.value)}><option value="">Walk-in customer</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.fullName}{patient.phone ? ` - ${patient.phone}` : ""}</option>)}</select></label><label className="sales-date">Date<input type="date" value={saleDate} onChange={(event) => setSaleDate(event.target.value)} /></label></div>
      <div className="sales-product-label">Product</div>
      <div className="sales-lines"><div className="sales-line-heading"><span>Product</span><span>Stock</span><span>Quantity</span>{!isPharmacist && <span>Purchase Price</span>}<span>Price</span><span>Total</span><span><button className="sales-add-line" type="button" aria-label="Add product row" onClick={() => setLines((all) => [...all, { productId: "", quantity: 1 }])}>＋</button></span></div>
        {lines.map((line, index) => { const product = products.find((item) => item.id === line.productId); return <div className="sales-line" key={index}><label className="sr-only" htmlFor={`sale-product-${index}`}>Product</label><select id={`sale-product-${index}`} value={line.productId} onChange={(event) => update(index, { productId: event.target.value })}><option value="">Select</option>{products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><output>{product?.quantity ?? "—"}</output><input aria-label="Quantity" type="number" min="1" value={line.quantity} onChange={(event) => update(index, { quantity: Math.max(1, Number(event.target.value)) })} />{!isPharmacist && <output>{product?.costPrice != null ? format(Number(product.costPrice)) : "—"}</output>}<output>{product ? format(Number(product.salePrice)) : "—"}</output><output>{product ? format(Number(product.salePrice) * line.quantity) : "0.00"}</output><button className="sales-remove" type="button" aria-label="Remove item" onClick={() => setLines((all) => all.length > 1 ? all.filter((_, i) => i !== index) : [{ productId: "", quantity: 1 }])}>−</button></div>; })}
      </div>
      <div className="sales-totals"><label>Total Amount<output>{format(subtotal)}</output></label><label>Discount<input type="number" min="0" max={subtotal} step="0.01" value={discount} onChange={(event) => setDiscount(Math.min(subtotal, Math.max(0, Number(event.target.value))))} /></label><label>Final Total<output>{format(totalDue)}</output></label><label>Paid<input type="number" min="0" max={totalDue} step="0.01" value={paidAmount} onChange={(event) => setPaidAmount(Math.min(totalDue, Math.max(0, Number(event.target.value))))} /></label></div>
      <div className="sales-payment-panel"><label>Payment Method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="">Select payment method</option>{paymentMethods.map((method) => <option key={method.id} value={method.name ?? method.method ?? ""}>{method.name ?? method.method ?? "Payment method"}</option>)}{paymentMethods.length === 0 && <><option>Cash</option><option>Zaad</option><option>EVC Plus</option><option>Bank</option></>}</select></label><label>Accounts<select defaultValue=""><option value="">Daily Account</option>{accounts.map((account) => <option key={account.id} value={account.name}>{account.name ?? account.currency ?? "Account"}</option>)}</select></label><label className="sales-payment-date">Sale date<input type="date" value={saleDate} readOnly /></label></div>
      {notice && <p className="sales-notice" role="status">{notice}</p>}
      <button className="sales-confirm" disabled={busy}>{busy ? "Saving…" : "Confirm"}</button>
    </form>
    {addingCustomer && <div className="sales-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAddingCustomer(false); }}><form className="sales-customer-modal" onSubmit={addCustomer}><div><h2>Add New Customer</h2><button type="button" aria-label="Close" onClick={() => setAddingCustomer(false)}>×</button></div><label>Full name<input required minLength={2} value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label><label>Phone<input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} /></label><button disabled={busy} className="sales-confirm">{busy ? "Saving…" : "Save Customer"}</button></form></div>}
  </section>;
}
