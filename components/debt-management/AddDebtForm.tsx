"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Customer = { id: string; fullName: string };
type Account = { id: string; name: string };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export default function AddDebtForm() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/debt-management", { cache: "no-store" })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error || "Options could not be loaded."); if (active) { setCustomers(result.options?.customers ?? []); setAccounts(result.options?.accounts ?? []); } })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Options could not be loaded."); });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const customer = customers.find(item => item.id === customerId);
    const account = accounts.find(item => item.id === accountId);
    try {
      const response = await fetch("/api/debt-management", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "Customer debt", debtType: "Customer debt", customerId, customerName: customer?.fullName, accountId, accountName: account?.name, amount: Number(amount), total: Number(amount), paidAmount: 0, balance: Number(amount), date, note, description: note }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Debt could not be saved.");
      router.push("/debt-management/report"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Debt could not be saved."); }
    finally { setBusy(false); }
  }

  return <main className="debt-add-page"><section className="debt-add-card"><header><h1>Add New Debt</h1></header><form onSubmit={submit}>
    <label><span>Customer <b>*</b></span><select required value={customerId} onChange={e => setCustomerId(e.target.value)}><option value="">-- Select Customer --</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.fullName}</option>)}</select></label>
    <label><span>Accounts <b>*</b></span><select required value={accountId} onChange={e => setAccountId(e.target.value)}><option value="">Select</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
    <label><span>Amount <b>*</b></span><input required type="number" min="0.01" step="0.01" placeholder="Enter amount" value={amount} onChange={e => setAmount(e.target.value)} /></label>
    <label><span>Date <b>*</b></span><input required type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
    <label><span>Note</span><textarea placeholder="Optional note" value={note} onChange={e => setNote(e.target.value)} /></label>
    <div className="debt-add-actions"><button type="submit" disabled={busy}>{busy ? "Saving…" : "Confirm"}</button><Link href="/debt-management/report">← Back</Link></div>
    {error && <p role="alert" className="debt-error">{error}</p>}
  </form></section></main>;
}
