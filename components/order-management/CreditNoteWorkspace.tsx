"use client";

import { useEffect, useMemo, useState } from "react";

type CreditItem = { productId: string; name: string; quantity: number; unitPrice: number };
type CreditSale = { id: string; date: string; total: number; paidAmount: number; creditAmount: number; remainingCredit: number; patient: { id: string; fullName: string; phone: string | null } | null; items: CreditItem[] };
type Option = { id: string; name?: string; method?: string; currency?: string };
const amount = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const key = (sale: CreditSale) => sale.patient?.id || "walk-in";

export default function CreditNoteWorkspace() {
  const [sales, setSales] = useState<CreditSale[]>([]); const [methods, setMethods] = useState<Option[]>([]); const [accounts, setAccounts] = useState<Option[]>([]);
  const [branchName, setBranchName] = useState("Branch"); const [customer, setCustomer] = useState(""); const [saleId, setSaleId] = useState(""); const [creditAmount, setCreditAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState(""); const [accountId, setAccountId] = useState(""); const [notes, setNotes] = useState(""); const [notice, setNotice] = useState(""); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  useEffect(() => {
    Promise.all([fetch("/api/order-management/credit-note?sourceSales=true").then((r) => r.ok ? r.json() : null), fetch("/api/setup/payment-methods").then((r) => r.ok ? r.json() : null), fetch("/api/setup/accounts").then((r) => r.ok ? r.json() : null), fetch("/api/setup/branches").then((r) => r.ok ? r.json() : null), fetch("/api/auth/session").then((r) => r.ok ? r.json() : null)])
      .then(([salesResult, methodsResult, accountsResult, branchesResult, session]) => {
        const rows = salesResult?.data ?? []; setSales(rows); setMethods(methodsResult?.data ?? []); setAccounts(accountsResult?.data ?? []);
        setBranchName(branchesResult?.data?.find((branch: Option) => branch.id === session?.data?.branchId)?.name ?? branchesResult?.data?.[0]?.name ?? "Branch");
        const first = rows.find((sale: CreditSale) => sale.remainingCredit > 0); if (first) { setCustomer(key(first)); setSaleId(first.id); }
      }).catch(() => setNotice("Credit note data could not be loaded.")).finally(() => setLoading(false));
  }, []);
  const customers = useMemo(() => { const list = new Map<string, string>(); for (const sale of sales) list.set(key(sale), sale.patient?.fullName ?? "Walk-in customer"); return [...list].map(([id, name]) => ({ id, name })); }, [sales]);
  const customerSales = useMemo(() => sales.filter((sale) => key(sale) === customer), [sales, customer]);
  const selectedSale = sales.find((sale) => sale.id === saleId) ?? null;
  const maxCredit = selectedSale?.remainingCredit ?? 0;
  function selectCustomer(value: string) { setCustomer(value); const sale = sales.find((row) => key(row) === value && row.remainingCredit > 0); setSaleId(sale?.id ?? ""); setCreditAmount(0); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setNotice(""); if (!selectedSale || creditAmount <= 0) { setNotice("Dooro iib oo geli qadarka credit note-ka."); return; } if (creditAmount > maxCredit) { setNotice("Credit-ku wuu ka badan yahay qadarka iibka ee weli bannaan."); return; }
    setSaving(true);
    try { const response = await fetch("/api/order-management/credit-note", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ saleId: selectedSale.id, amount: creditAmount, paymentMethod, accountId, notes }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Credit note lama samayn karin."); setNotice("Credit note-ka waa la diiwaangeliyey."); setCreditAmount(0); const fresh = await fetch("/api/order-management/credit-note?sourceSales=true", { cache: "no-store" }).then((r) => r.json()); setSales(fresh.data ?? []); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Credit note lama samayn karin."); } finally { setSaving(false); }
  }
  return <div className="credit-page"><form className="credit-card" onSubmit={submit}>
    <header className="credit-heading"><h1>Credit Note {branchName}</h1><span>Exchange Rate 11,850</span></header>
    <div className="credit-top"><label>Select Customer<select value={customer} onChange={(event) => selectCustomer(event.target.value)}><option value="">Select Customer</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Date<input type="date" value={new Date().toISOString().slice(0, 10)} readOnly /></label></div>
    <label className="credit-sale">Sale<select value={saleId} onChange={(event) => { setSaleId(event.target.value); setCreditAmount(0); }} disabled={!customerSales.length}><option value="">Select sale</option>{customerSales.map((sale) => <option key={sale.id} value={sale.id}>{new Date(sale.date).toLocaleString()} · Total {amount(sale.total)} · Credit available {amount(sale.remainingCredit)}</option>)}</select></label>
    <div className="credit-table"><div className="credit-table-head"><span>Product</span><span>Quantity</span><span>Price</span><span>Total</span><span></span></div>{loading ? <div className="credit-empty">Loading sales…</div> : selectedSale?.items.length ? selectedSale.items.map((item) => <div className="credit-row" key={item.productId}><strong>{item.name}</strong><span>{item.quantity}</span><span>{amount(item.unitPrice)}</span><output>{amount(item.quantity * item.unitPrice)}</output><span /></div>) : <div className="credit-empty">Dooro macmiil iyo iib si alaabtiisu halkan uga muuqato.</div>}</div>
    <div className="credit-totals"><label>Total Amount<output>{amount(selectedSale?.total ?? 0)}</output></label><label>Used Credit<output className="credit-discount">{amount(selectedSale?.creditAmount ?? 0)}</output></label><label>Final Total<output>{amount(maxCredit)}</output></label><label>Credit amount<input type="number" min="0" max={maxCredit} step="0.01" value={creditAmount || ""} onChange={(event) => setCreditAmount(Math.max(0, Math.min(maxCredit, Number(event.target.value))))} placeholder="0.00" /></label></div>
    <div className="credit-payment"><label>Payment Method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="">Select</option>{methods.map((method) => <option key={method.id} value={method.name ?? method.method ?? ""}>{method.name ?? method.method ?? "Payment method"}</option>)}{!methods.length && <><option>Cash</option><option>Zaad</option><option>EVC Plus</option></>}</select></label><label>Accounts<select value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Daily Account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name ?? account.currency ?? "Account"}</option>)}</select></label><label>Note<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Faahfaahin halkan…" /></label></div>
    {notice && <p className="credit-notice" role="status">{notice}</p>}<button className="credit-confirm" disabled={saving || loading}>{saving ? "Saving…" : "Confirm"}</button>
  </form></div>;
}
