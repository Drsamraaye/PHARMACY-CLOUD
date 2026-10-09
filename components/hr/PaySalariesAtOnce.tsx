"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Employee = { id: string; fullname?: string; phone?: string; jobTitle?: string; branch?: string; salary?: number | string; paid?: number; generalBalance?: number; taxRate?: number | string; taxAmount?: number };
type PaymentMethod = { id: string; name?: string; method?: string };
type RowEntry = { amount: string; note: string };
const fmt = (value: unknown) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function PaySalariesAtOnce() {
  const [employees, setEmployees] = useState<Employee[]>([]); const [methods, setMethods] = useState<PaymentMethod[]>([]); const [entries, setEntries] = useState<Record<string, RowEntry>>({}); const [method, setMethod] = useState("");
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); try { const [employeeResponse, methodResponse] = await Promise.all([fetch("/api/hr/employees", { cache: "no-store" }), fetch("/api/setup/payment-methods", { cache: "no-store" })]); const [employeeResult, methodResult] = await Promise.all([employeeResponse.json(), methodResponse.json()]); if (!employeeResponse.ok) throw new Error(employeeResult.error || "Could not load employees."); if (!methodResponse.ok) throw new Error(methodResult.error || "Could not load payment methods."); setEmployees(Array.isArray(employeeResult.data) ? employeeResult.data : []); setMethods(Array.isArray(methodResult.data) ? methodResult.data : []); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load salary data."); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const totals = useMemo(() => employees.reduce((sum, employee) => ({ tax: sum.tax + Number(employee.taxAmount || 0), salary: sum.salary + Number(employee.salary || 0), paid: sum.paid + Number(employee.paid || 0), balance: sum.balance + Number(employee.generalBalance || 0) }), { tax: 0, salary: 0, paid: 0, balance: 0 }), [employees]);
  function update(id: string, patch: Partial<RowEntry>) { setEntries(old => ({ ...old, [id]: { ...old[id], ...patch, amount: patch.amount ?? old[id]?.amount ?? "", note: patch.note ?? old[id]?.note ?? "" } })); }
  async function confirmPayments(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSuccess("");
    if (!method) { setError("Select a payment method."); return; }
    const pending = employees.map(employee => ({ employee, amount: Number(entries[employee.id]?.amount || 0), note: entries[employee.id]?.note?.trim() || "" })).filter(item => item.amount > 0);
    if (pending.length === 0) { setError("Enter an amount for at least one employee."); return; }
    for (const item of pending) { if (!Number.isFinite(item.amount) || item.amount < 0) { setError("Payment amounts must be zero or greater."); return; } if (item.amount > Number(item.employee.generalBalance || 0)) { setError(`The amount for ${item.employee.fullname || "an employee"} is greater than the remaining balance.`); return; } }
    if (!window.confirm(`Confirm salary payments for ${pending.length} employee${pending.length === 1 ? "" : "s"}?`)) return;
    setBusy(true); let completed = 0; const completedIds: string[] = [];
    try {
      for (const item of pending) {
        const response = await fetch("/api/hr/salary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeeId: item.employee.id, employeeName: item.employee.fullname || "Employee", month: new Date().toLocaleString("en-US", { month: "long" }), monthKey: new Date().toISOString().slice(0, 7), date: new Date().toISOString().slice(0, 10), paidAmount: item.amount, deductionAmount: 0, promotion: 0, note: item.note, paymentMethod: method, currency: "Dollar" }) });
        const result = await response.json(); if (!response.ok) throw new Error(result.error || `Could not save salary for ${item.employee.fullname || "employee"}.`); completed++; completedIds.push(item.employee.id);
      }
      setEntries({}); setSuccess(`${completed} salary payment${completed === 1 ? "" : "s"} saved.`); await load();
    } catch (cause) { const message = `${cause instanceof Error ? cause.message : "A salary payment could not be saved."}${completed ? ` ${completed} payment(s) were already saved.` : ""}`; setEntries(old => Object.fromEntries(Object.entries(old).filter(([id]) => !completedIds.includes(id)))); await load(); setError(message); }
    finally { setBusy(false); }
  }
  return <main className="hr-page"><section className="hr-card hr-pay-all-card"><header className="hr-pay-all-heading"><h1>Paid Employee Salary One Time</h1><Link href="/human-resource/employees/add">Add New Employee</Link><Link className="hr-deleted-list" href="/human-resource/employees/deleted">Deleted Employee List</Link></header>
    {error && <p className="hr-error" role="alert">{error}</p>}{success && <p className="hr-success" role="status">{success}</p>}
    <form onSubmit={confirmPayments}><div className="hr-table-wrap hr-pay-all-table-wrap"><table className="hr-table hr-pay-all-table"><thead><tr><th>#</th><th>Name</th><th>Phone</th><th>Branch</th><th>Job Title</th><th>Tax rate</th><th>tax amount</th><th>Salary</th><th>Paid</th><th>general.Balance</th><th>Note</th><th>amount</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={12} className="hr-empty">Loading...</td></tr> : employees.length === 0 ? <tr><td colSpan={12} className="hr-empty">No employees found.</td></tr> : employees.map((employee, index) => <tr key={employee.id}><td>{index + 1}</td><td>{employee.fullname || "—"}</td><td>{employee.phone || "—"}</td><td>{employee.branch || "—"}</td><td>{employee.jobTitle || "—"}</td><td>{Number(employee.taxRate || 0)}%</td><td>{fmt(employee.taxAmount)}</td><td>{fmt(employee.salary)}</td><td>{fmt(employee.paid)}</td><td>{fmt(employee.generalBalance)}</td><td><input aria-label={`Note for ${employee.fullname || "employee"}`} value={entries[employee.id]?.note || ""} onChange={event => update(employee.id, { note: event.target.value })} /></td><td><input aria-label={`Payment amount for ${employee.fullname || "employee"}`} type="number" min="0" max={Number(employee.generalBalance || 0)} step="any" value={entries[employee.id]?.amount || ""} onChange={event => update(employee.id, { amount: event.target.value })} /></td></tr>)}
    </tbody><tfoot><tr><th>Total</th>{Array.from({ length: 5 }, (_, index) => <th key={`blank-${index}`} />)}<th>{fmt(totals.tax)}</th><th>{fmt(totals.salary)}</th><th>{fmt(totals.paid)}</th><th>{fmt(totals.balance)}</th><th colSpan={2} /></tr></tfoot></table></div>
      <label className="hr-pay-all-method">Select Payment Method<select required value={method} onChange={event => setMethod(event.target.value)}><option value="">Select</option>{methods.map(item => <option key={item.id} value={item.name || item.method || ""}>{item.name || item.method}</option>)}</select></label>
      <button className="hr-pay-all-confirm" disabled={busy || loading || employees.length === 0}>{busy ? "Saving..." : "Confirm"}</button>
    </form>
  </section></main>;
}
