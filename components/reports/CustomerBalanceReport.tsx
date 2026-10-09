"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Customer = { id: string; name: string; phone: string; balance: number; transactions: number };
type Option = { id: string; name?: string; fullName?: string; method?: string; accountName?: string };
type Payment = { id: string; date: string; amount: number; method: string; userId: string };
const money = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CustomerBalanceReport() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<Option[]>([]);
  const [users, setUsers] = useState<Option[]>([]);
  const [branchId, setBranchId] = useState("");
  const [userId, setUserId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [methods, setMethods] = useState<Option[]>([]);
  const [accounts, setAccounts] = useState<Option[]>([]);
  const [paymentError, setPaymentError] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [totals, setTotals] = useState({ balance: 0, customers: 0, transactions: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ branchId, userId });
      const response = await fetch(`/api/reports/customer-balance?${query}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Customer balance lama soo rari karin.");
      setRows(result.data ?? []);
      setBranches(result.options?.branches ?? []);
      setUsers(result.options?.users ?? []);
      setTotals(result.totals ?? { balance: 0, customers: 0, transactions: 0 });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Customer balance lama soo rari karin.");
    } finally {
      setLoading(false);
    }
  }, [branchId, userId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    Promise.all(["/api/setup/payment-methods", "/api/setup/accounts"].map(url => fetch(url, { cache: "no-store" }).then(response => response.json())))
      .then(([methodResult, accountResult]) => { setMethods(methodResult.data ?? []); setAccounts(accountResult.data ?? []); })
      .catch(() => undefined);
  }, []);

  const visibleRows = useMemo(() => rows.filter(row => `${row.name} ${row.phone}`.toLowerCase().includes(search.trim().toLowerCase())), [rows, search]);

  async function showHistory(customer: Customer) {
    setHistoryCustomer(customer);
    setPayments([]);
    try {
      const response = await fetch(`/api/reports/customer-balance/payments?patientId=${encodeURIComponent(customer.id)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Payment history lama soo rari karin.");
      setPayments(result.data ?? []);
    } catch (cause) {
      setPaymentError(cause instanceof Error ? cause.message : "Payment history lama soo rari karin.");
    }
  }

  async function submitPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paymentCustomer) return;
    setPaymentBusy(true);
    setPaymentError("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    body.patientId = paymentCustomer.id;
    body.branchId = branchId;
    body.amount = Number(body.amount) as unknown as FormDataEntryValue;
    try {
      const response = await fetch("/api/order-management/receive-payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Lacagta lama diiwaangelin.");
      setPaymentCustomer(null);
      await load();
    } catch (cause) {
      setPaymentError(cause instanceof Error ? cause.message : "Lacagta lama diiwaangelin.");
    } finally {
      setPaymentBusy(false);
    }
  }

  return <main className="customer-balance-page"><section className="customer-balance-card">
    <header>Customer Balance Report</header>
    <div className="customer-balance-metrics">
      <article className="balance-total"><span>Total Balance</span><strong>{money(totals.balance)}</strong></article>
      <article className="balance-customers"><span>Total Customers</span><strong>{totals.customers}</strong></article>
      <article className="balance-transactions"><span>Total Transactions</span><strong>{totals.transactions}</strong><small>Invoices with outstanding balance</small></article>
    </div>
    <div className="customer-balance-filters">
      {branches.length > 0 && <label>Branch<select value={branchId} onChange={event => setBranchId(event.target.value)}><option value="">All Branches</option>{branches.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      <label>Name<input type="search" placeholder="Search name or phone" value={search} onChange={event => setSearch(event.target.value)} /></label>
      {users.length > 0 && <label>User<select value={userId} onChange={event => setUserId(event.target.value)}><option value="">All</option>{users.map(item => <option key={item.id} value={item.id}>{item.fullName ?? item.name}</option>)}</select></label>}
      <button type="button" onClick={() => void load()} disabled={loading}>{loading ? "Loading…" : "Search"}</button>
    </div>
    <div className="customer-balance-print"><button type="button" onClick={() => window.print()}>▣ Print Report</button></div>
    {error && <p className="customer-balance-error" role="alert">{error}</p>}
    <div className="customer-balance-table-wrap"><table><thead><tr><th>#</th><th>Name</th><th>Phone</th><th>Balance</th><th>Action</th><th>Payment History</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={6} className="customer-balance-empty">Loading…</td></tr> : visibleRows.length ? visibleRows.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td><button className="balance-statement" type="button" onClick={() => { window.location.href = `/reports/customer-statement?patientId=${encodeURIComponent(row.id)}`; }}>Statement</button><strong>{row.name}</strong></td><td>{row.phone}</td><td><span className="balance-pill">{money(row.balance)}</span></td><td><button className="balance-pay" type="button" onClick={() => { setPaymentError(""); setPaymentCustomer(row); }}>Paid Now</button></td><td><button className="balance-history" type="button" onClick={() => { setPaymentError(""); void showHistory(row); }}>Payment History</button></td></tr>) : <tr><td colSpan={6} className="customer-balance-empty">No outstanding customer balances found.</td></tr>}
      {!loading && <tr className="customer-balance-total"><th colSpan={3}>Total</th><td>{money(totals.balance)}</td><td colSpan={2}></td></tr>}
    </tbody></table></div>
  </section>
  {paymentCustomer && <div className="customer-balance-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setPaymentCustomer(null); }}><form className="customer-balance-modal" onSubmit={submitPayment}><header><strong>Receive payment · {paymentCustomer.name}</strong><button type="button" aria-label="Close" onClick={() => setPaymentCustomer(null)}>×</button></header><p>Outstanding balance: {money(paymentCustomer.balance)}</p><label>Amount received<input type="number" name="amount" min="0.01" max={paymentCustomer.balance} step="0.01" required autoFocus /></label><label>Payment method<select name="paymentMethod" defaultValue=""><option value="">Select method</option>{methods.map(method => <option key={method.id} value={method.method || method.name || method.accountName}>{method.method || method.name || method.accountName}</option>)}</select></label><label>Account<select name="accountId" defaultValue=""><option value="">Select account</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name || account.accountName}</option>)}</select></label>{paymentError && <p className="customer-balance-error" role="alert">{paymentError}</p>}<footer><button type="button" onClick={() => setPaymentCustomer(null)}>Cancel</button><button disabled={paymentBusy}>{paymentBusy ? "Saving…" : "Save payment"}</button></footer></form></div>}
  {historyCustomer && <div className="customer-balance-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setHistoryCustomer(null); }}><section className="customer-balance-modal history-modal"><header><strong>Payment History · {historyCustomer.name}</strong><button type="button" aria-label="Close" onClick={() => setHistoryCustomer(null)}>×</button></header>{paymentError && <p className="customer-balance-error" role="alert">{paymentError}</p>}<div className="customer-payment-history"><table><thead><tr><th>Date</th><th>Amount</th><th>Method</th></tr></thead><tbody>{payments.length ? payments.map(payment => <tr key={payment.id}><td>{new Date(payment.date).toLocaleString()}</td><td>{money(payment.amount)}</td><td>{payment.method}</td></tr>) : <tr><td colSpan={3}>No payment history found.</td></tr>}</tbody></table></div></section></div>}
  </main>;
}
