"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateBankAccount() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [openingBalance, setOpeningBalance] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/bank/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), currency, openingBalance: Number(openingBalance || 0) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Bank account lama abuuri karin.");
      router.push("/setup/accounts"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Bank account lama abuuri karin."); }
    finally { setBusy(false); }
  }
  return <main className="bank-forms-page"><section className="bank-form-card"><header><div><h1>Create Bank Account</h1><p>Enter the account details and save.</p></div></header><form onSubmit={submit}>
    <label>Account Name<input required minLength={2} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Main Account" /></label>
    <label>Currency<select value={currency} onChange={event => setCurrency(event.target.value)}>{["USD", "SOS", "ETB"].map(value => <option key={value}>{value}</option>)}</select></label>
    <label>Opening Balance<input type="number" min="0" step="0.01" value={openingBalance} onChange={event => setOpeningBalance(event.target.value)} placeholder="0.00" /></label>
    {error && <p className="bank-form-error" role="alert">{error}</p>}
    <footer><Link href="/setup/accounts">Cancel</Link><button disabled={busy}>{busy ? "Saving…" : "Save"}</button></footer>
  </form></section></main>;
}
