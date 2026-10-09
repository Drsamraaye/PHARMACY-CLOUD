"use client";

import { useEffect, useMemo, useState } from "react";

type PayrollRow = { id: string; date?: string; employeeId?: string; employeeName?: string; phone?: string; branch?: string; month?: string; paidBy?: string; note?: string; promotion?: number; deductionAmount?: number; paidAmount?: number; totalPaid?: number; generalBalance?: number; currency?: string; branchId?: string };
type Employee = { id: string; fullname?: string; fullName?: string };
type Branch = { id: string; name: string };
const today = new Date();
const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const money = (value: unknown) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function PayrollReport() {
  const [rows, setRows] = useState<PayrollRow[]>([]); const [employees, setEmployees] = useState<Employee[]>([]); const [branches, setBranches] = useState<Branch[]>([]);
  const [year, setYear] = useState(String(today.getFullYear())); const [currency, setCurrency] = useState("Dollar"); const [branch, setBranch] = useState("all"); const [employee, setEmployee] = useState("all");
  const [startDate, setStartDate] = useState(`${today.getFullYear()}-01-01`); const [endDate, setEndDate] = useState(isoDate(today)); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { let active = true; Promise.all(["/api/hr/salary", "/api/hr/employees", "/api/setup/branches"].map(async url => { const response = await fetch(url, { cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not load report data."); return result.data ?? []; })).then(([payments, staff, locations]) => { if (!active) return; setRows(Array.isArray(payments) ? payments : []); setEmployees(Array.isArray(staff) ? staff : []); setBranches(Array.isArray(locations) ? locations : []); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Could not load report data."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  const filtered = useMemo(() => rows.filter(row => {
    const date = row.date ? new Date(row.date) : null;
    const dateKey = date && !Number.isNaN(date.getTime()) ? isoDate(date) : "";
    return (!date || String(date.getFullYear()) === year) && (row.currency || "Dollar") === currency && (branch === "all" || row.branchId === branch) && (employee === "all" || row.employeeId === employee) && (!startDate || !dateKey || dateKey >= startDate) && (!endDate || !dateKey || dateKey <= endDate);
  }), [rows, year, currency, branch, employee, startDate, endDate]);
  const totals = useMemo(() => filtered.reduce((sum, row) => ({ promotion: sum.promotion + Number(row.promotion || 0), deduction: sum.deduction + Number(row.deductionAmount || 0), paid: sum.paid + Number(row.paidAmount || 0), total: sum.total + Number(row.totalPaid ?? row.paidAmount ?? 0), balance: sum.balance + Number(row.generalBalance || 0) }), { promotion: 0, deduction: 0, paid: 0, total: 0, balance: 0 }), [filtered]);
  const yearOptions = Array.from({ length: 8 }, (_, index) => today.getFullYear() - index);
  return <main className="hr-page"><section className="hr-card payroll-report-card"><header className="hr-card-title"><h1>Employee Salary Details Report</h1></header>
    <div className="payroll-filter-grid"><label>Year<select value={year} onChange={event => setYear(event.target.value)}>{yearOptions.map(item => <option key={item}>{item}</option>)}</select></label><label>Select Currency<select value={currency} onChange={event => setCurrency(event.target.value)}><option>Dollar</option><option>Shilling</option><option>Birr</option></select></label><label>Branch<select value={branch} onChange={event => setBranch(event.target.value)}><option value="all">All</option>{branches.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Employee<select value={employee} onChange={event => setEmployee(event.target.value)}><option value="all">All</option>{employees.map(item => <option key={item.id} value={item.id}>{item.fullname || item.fullName || "Employee"}</option>)}</select></label></div>
    <div className="payroll-date-actions"><label>Start Date <b>*</b><input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></label><label>End Date <b>*</b><input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} /></label><button onClick={() => setError("")}>Search</button><button className="payroll-print" onClick={() => window.print()}>Print</button></div>
    {error && <p className="hr-error" role="alert">{error}</p>}
    <div className="hr-table-wrap payroll-table-wrap"><table className="hr-table payroll-table"><thead><tr><th>SL</th><th>Date</th><th>Employee</th><th>Phone</th><th>Branch</th><th>Month</th><th>Paid By</th><th>Note</th><th>Promotion</th><th>Deduction</th><th>Paid</th><th>Total Paid</th><th>generalBalance</th><th>Action</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={14} className="hr-empty">Loading...</td></tr> : filtered.length === 0 ? <tr><td colSpan={14} className="hr-empty">No payroll records found.</td></tr> : filtered.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td>{row.date ? new Date(row.date).toLocaleString() : "—"}</td><td>{row.employeeName || "—"}</td><td>{row.phone || "—"}</td><td>{row.branch || "—"}</td><td>{row.month || "—"}</td><td>{row.paidBy || "—"}</td><td>{row.note || "—"}</td><td>{money(row.promotion)}</td><td>{money(row.deductionAmount)}</td><td>{money(row.paidAmount)}</td><td>{money(row.totalPaid ?? row.paidAmount)}</td><td>{money(row.generalBalance)}</td><td>—</td></tr>)}
    </tbody><tfoot><tr><th>Total</th>{Array.from({ length: 7 }, (_, index) => <th key={`blank-${index}`} />)}<th>{money(totals.promotion)}</th><th>{money(totals.deduction)}</th><th>{money(totals.paid)}</th><th>{money(totals.total)}</th><th>{money(totals.balance)}</th><th /></tr></tfoot></table></div>
  </section></main>;
}
