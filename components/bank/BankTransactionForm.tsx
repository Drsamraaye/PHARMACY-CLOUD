"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type BankAccount = { id: string; name: string; currency: string };
type ChartAccount = { id: string; name?: string; accountName?: string };

export default function BankTransactionForm({ mode }: { mode: "DEPOSIT" | "WITHDRAWAL" }) {
  const router = useRouter();
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [chartAccounts, setChartAccounts] = useState<ChartAccount[]>([]);
  const [accountId, setAccountId] = useState("");
  const [chartAccountId, setChartAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([fetch("/api/bank/accounts", { cache: "no-store" }).then(response => response.json()), fetch("/api/setup/accounts", { cache: "no-store" }).then(response => response.json())])
      .then(([bankResult, chartResult]) => { setBanks(bankResult.data ?? []); setChartAccounts(chartResult.data ?? []); })
      .catch(() => setError("Accounts lama soo rari karin."))
      .finally(() => setLoading(false));
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch(mode === "DEPOSIT" ? "/api/bank/deposit" : "/api/bank/withdraw", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId, amount: Number(amount), reference: chartAccountId || undefined, description: note.trim() || undefined, date }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Transaction lama kaydin karin.");
      router.push("/bank"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Transaction lama kaydin karin."); }
    finally { setBusy(false); }
  }
  const title = mode === "DEPOSIT" ? "Deposit Account" : "Withdraw Account";
  return <main className="bank-forms-page"><section className="bank-form-card bank-transaction-form"><header><div><h1>{title}</h1><p>Record the transaction in the selected bank account.</p></div></header><form onSubmit={submit}>
    <label>Select Bank Account<select required value={accountId} onChange={event => setAccountId(event.target.value)} disabled={loading}><option value="">{loading ? "Loading accounts…" : "Please Select"}</option>{banks.map(account => <option key={account.id} value={account.id}>{account.name} ({account.currency})</option>)}</select></label>
    <label>Amount<input required type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} /></label>
    <label>Note<input value={note} onChange={event => setNote(event.target.value)} placeholder="Optional note" /></label>
    <label>Date<input required type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
    <label>Select Account<select required value={chartAccountId} onChange={event => setChartAccountId(event.target.value)}><option value="">Please Select</option>{chartAccounts.map(account => <option key={account.id} value={account.id}>{account.name ?? account.accountName ?? "Account"}</option>)}</select></label>
    {error && <p className="bank-form-error" role="alert">{error}</p>}
    <footer><Link href="/bank">Cancel</Link><button disabled={busy || loading || banks.length === 0 || chartAccounts.length === 0}>{busy ? "Saving…" : "Confirm"}</button></footer>
  </form></section></main>;
}
