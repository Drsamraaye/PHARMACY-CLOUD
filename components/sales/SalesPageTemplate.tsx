"use client";

import { useEffect, useMemo, useState } from "react";

type Product = { id: string; name: string; barcode?: string | null; salePrice: number | string; salePrice2?: number | string; costPrice?: number | string; quantity: number };
type Line = { productId: string; quantity: number };
type Patient = { id: string; fullName: string; phone?: string | null };
type SelectOption = { id: string; name?: string; method?: string; currency?: string };
type PaymentEntry = { method: string; currency: "USD" | "SLSh"; amount: string };
const endpoints = { pharmacy: { type: "PHARMACY", sales: "/api/order-management/pharmacy-sales" }, lab: { type: "LAB", sales: "/api/order-management/laboratory-sales" }, service: { type: "SERVICE", sales: "/api/order-management/services-order" } };
const titles = { pharmacy: "Pharmacy Sales Page", lab: "Laboratory Sales Page", service: "Service Order Page" };
const format = (value: number) => value.toFixed(2);

/** Shared point-of-sale workflow styled to match the reference system's sales screen. */
export default function SalesPageTemplate({ type }: { type: "pharmacy" | "lab" | "service" }) {
  const config = endpoints[type];
  const [products, setProducts] = useState<Product[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [accounts, setAccounts] = useState<SelectOption[]>([]);
  const [branchName, setBranchName] = useState("Branch");
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [lines, setLines] = useState<Line[]>([{ productId: "", quantity: 1 }]);
  const [patientId, setPatientId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [payments, setPayments] = useState<PaymentEntry[]>([{ method: "Cash Dollar", currency: "USD", amount: "" }]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [barcode, setBarcode] = useState("");
  const [lastInvoice, setLastInvoice] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/products?type=${config.type}`).then((r) => r.ok ? r.json() : null),
      fetch("/api/patients").then((r) => r.ok ? r.json() : null),
      fetch("/api/setup/accounts").then((r) => r.ok ? r.json() : null),
      fetch("/api/setup/branches").then((r) => r.ok ? r.json() : null),
      fetch("/api/auth/session").then((r) => r.ok ? r.json() : null),
      fetch("/api/setup/exchange-rate").then((r) => r.ok ? r.json() : null),
    ]).then(([p, c, accountList, branchList, session, rates]) => {
      setProducts(p?.data ?? []); setPatients(c?.data ?? []); setAccounts(accountList?.data ?? []);
      setBranchName(branchList?.data?.find((branch: SelectOption) => branch.id === session?.data?.branchId)?.name ?? branchList?.data?.[0]?.name ?? "Branch");
      setUserName(session?.data?.fullName ?? "");
      setUserRole(session?.data?.role ?? "");
      setExchangeRate(rates?.currentRate ?? null);
    }).catch(() => setNotice("Xogta iibka lama soo rari karin. Dib u cusboonaysii bogga."));
  }, [config.type]);

  const subtotal = useMemo(() => lines.reduce((sum, line) => { const product = products.find((item) => item.id === line.productId); return sum + Number(product?.salePrice || 0) * line.quantity; }, 0), [lines, products]);
  const totalDue = Math.max(0, subtotal - discount);
  const paymentUsd = useMemo(() => payments.reduce((sum, payment) => sum + (Number(payment.amount || 0) * (payment.currency === "SLSh" ? 1 / (exchangeRate || 1) : 1)), 0), [payments, exchangeRate]);
  const outstandingUsd = Math.max(0, totalDue - paymentUsd);
  const customerCreditUsd = Math.max(0, paymentUsd - totalDue);
  function update(index: number, patch: Partial<Line>) { setLines((existing) => existing.map((line, i) => i === index ? { ...line, ...patch } : line)); }
  function scanBarcode(value: string) { const product = products.find((item) => item.barcode?.trim().toLocaleLowerCase() === value.trim().toLocaleLowerCase()); if (!product) { setNotice("Barcode-kan lagama helin alaabta."); return; } setLines((current) => { const existing = current.findIndex((line) => line.productId === product.id); return existing >= 0 ? current.map((line, i) => i === existing ? { ...line, quantity: line.quantity + 1 } : line) : [...current.filter((line) => line.productId), { productId: product.id, quantity: 1 }]; }); setBarcode(""); setNotice(`${product.name} waa lagu daray iibka.`); }
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
      const paymentLines = payments.filter((payment) => Number(payment.amount) > 0).map((payment) => ({ ...payment, amount: Number(payment.amount) }));
      const response = await fetch(config.sales, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId: patientId || null, discount, payments: paymentLines, createdAt: new Date(`${saleDate}T12:00:00`).toISOString(), items }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Iibka lama kaydin karin.");
      setNotice("Iibka si guul leh ayaa loo diiwaangeliyey."); setLastInvoice(result.data?.id ?? result.id ?? ""); setLines([{ productId: "", quantity: 1 }]); setDiscount(0); setPayments([{ method: "Cash Dollar", currency: "USD", amount: "" }]);
      const refreshed = await fetch(`/api/products?type=${config.type}`).then((r) => r.json()); setProducts(refreshed.data ?? []);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Iibka lama kaydin karin."); } finally { setBusy(false); }
  }

  const isPharmacist = userRole === "PHARMACIST";
  return <section className={`sales-page${isPharmacist ? " pharmacist-sales" : ""}`}>
    <form className="sales-workspace" onSubmit={submit}>
      <div className="sales-titlebar"><div className="sales-title-group"><h1>{titles[type]}</h1><span className="sales-chip">{branchName}</span>{userName && <span className="sales-user-chip">User: {userName}</span>}</div><div className="sales-header-actions"><button type="button" className="sales-pill-button" onClick={() => setAddingCustomer(true)}>＋ Add New Customer</button><button type="button" className="sales-pill-button" onClick={() => { setLines([{ productId: "", quantity: 1 }]); setPatientId(""); setDiscount(0); setPayments([{ method: "Cash Dollar", currency: "USD", amount: "" }]); }}>＋ New Tab</button></div></div>
      <label className="sales-barcode-scan">Scan or enter barcode<input value={barcode} onChange={(event) => setBarcode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); scanBarcode(barcode); } }} /></label>
      {lastInvoice && <div className="sales-invoice-confirmation">Invoice {lastInvoice.slice(-8).toUpperCase()} created. <a href={`/order-management/order-report?search=${encodeURIComponent(lastInvoice)}`}>View invoice</a> <button type="button" onClick={() => window.print()}>Print receipt</button></div>}
      <div className="sales-select-grid"><label>Select Customer<select value={patientId} onChange={(event) => setPatientId(event.target.value)}><option value="">Walk-in customer</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.fullName}{patient.phone ? ` - ${patient.phone}` : ""}</option>)}</select></label><label className="sales-date">Date<input type="date" value={saleDate} onChange={(event) => setSaleDate(event.target.value)} /></label></div>
      <div className="sales-product-label">Product</div>
      <div className="sales-lines"><div className="sales-line-heading"><span>Product</span><span>Stock</span><span>Quantity</span>{!isPharmacist && <span>Cost USD</span>}<span>Price USD</span><span>Price SLSh</span><span>Total USD</span><span><button className="sales-add-line" type="button" aria-label="Add product row" onClick={() => setLines((all) => [...all, { productId: "", quantity: 1 }])}>＋</button></span></div>
        {lines.map((line, index) => { const product = products.find((item) => item.id === line.productId); return <div className="sales-line" key={index}><label className="sr-only" htmlFor={`sale-product-${index}`}>Product</label><select id={`sale-product-${index}`} value={line.productId} onChange={(event) => update(index, { productId: event.target.value })}><option value="">Select</option>{products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><output>{product?.quantity ?? "—"}</output><input aria-label="Quantity" type="number" min="1" value={line.quantity} onChange={(event) => update(index, { quantity: Math.max(1, Number(event.target.value)) })} />{!isPharmacist && <output>{product?.costPrice != null ? format(Number(product.costPrice)) : "—"}</output>}<output>{product ? format(Number(product.salePrice)) : "—"}</output><output>{product && exchangeRate ? format(Number(product.salePrice) * exchangeRate) : "—"}</output><output>{product ? format(Number(product.salePrice) * line.quantity) : "0.00"}</output><button className="sales-remove" type="button" aria-label="Remove item" onClick={() => setLines((all) => all.length > 1 ? all.filter((_, i) => i !== index) : [{ productId: "", quantity: 1 }])}>−</button></div>; })}
      </div>
      <div className="sales-totals"><label>Total Amount (USD)<output>{format(subtotal)}</output></label><label>Discount (USD)<input type="number" min="0" max={subtotal} step="0.01" value={discount} onChange={(event) => setDiscount(Math.min(subtotal, Math.max(0, Number(event.target.value))))} /></label><label>Final Total (USD)<output>{format(totalDue)}</output></label><label>SLSh Equivalent<output>{exchangeRate ? format(totalDue * exchangeRate) : "Set rate"}</output></label></div>
      <div className="sales-payment-panel sales-split-payment"><div className="sales-split-heading"><strong>Payments · {exchangeRate ? `1 USD = ${exchangeRate.toLocaleString()} SLSh` : "Exchange rate not set"}</strong><button type="button" onClick={() => setPayments((rows) => rows.length < 4 ? [...rows, { method: "Cash Shilling", currency: "SLSh", amount: "" }] : rows)} disabled={payments.length >= 4}>＋ Add payment</button></div>{payments.map((payment, index) => <div className="sales-payment-row" key={index}><label>Method<select aria-label={`Payment method ${index + 1}`} value={payment.method} onChange={(event) => { const method = event.target.value; const currency = method.includes("Shilling") ? "SLSh" : "USD"; setPayments((rows) => rows.map((row, i) => i === index ? { ...row, method, currency } : row)); }}><option>Cash Shilling</option><option>Cash Dollar</option><option>Zaad Shilling</option><option>Zaad Dollar</option></select></label><label>Amount ({payment.currency})<input aria-label={`Amount ${index + 1} ${payment.currency}`} type="number" min="0" step="0.01" value={payment.amount} onChange={(event) => setPayments((rows) => rows.map((row, i) => i === index ? { ...row, amount: event.target.value } : row))} /></label>{index > 0 && <button type="button" className="sales-remove" aria-label="Remove payment" onClick={() => setPayments((rows) => rows.filter((_, i) => i !== index))}>−</button>}</div>)}<div className="sales-payment-totals"><span>Received (USD eq.) <strong>{format(paymentUsd)}</strong></span><span>Remaining <strong>{format(outstandingUsd)}</strong></span>{customerCreditUsd > 0 && <span>Customer credit <strong>{format(customerCreditUsd)}</strong></span>}</div><p>Overpayment is saved as customer credit. Select a customer before saving an overpayment.</p><label>Account<select defaultValue=""><option value="">Daily Account</option>{accounts.map((account) => <option key={account.id} value={account.name}>{account.name ?? account.currency ?? "Account"}</option>)}</select></label></div>
      {notice && <p className="sales-notice" role="status">{notice}</p>}
      <button className="sales-confirm" disabled={busy}>{busy ? "Saving…" : "Confirm"}</button>
    </form>
    {addingCustomer && <div className="sales-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAddingCustomer(false); }}><form className="sales-customer-modal" onSubmit={addCustomer}><div><h2>Add New Customer</h2><button type="button" aria-label="Close" onClick={() => setAddingCustomer(false)}>×</button></div><label>Full name<input required minLength={2} value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label><label>Phone<input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} /></label><button disabled={busy} className="sales-confirm">{busy ? "Saving…" : "Save Customer"}</button></form></div>}
  </section>;
}
