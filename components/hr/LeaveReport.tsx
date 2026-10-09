"use client";

import { useCallback, useEffect, useState } from "react";

type Employee = { id: string; fullname?: string; fullName?: string };
type Leave = { id: string; date?: string; employeeId?: string; employeeName?: string; approvedBy?: string; leavePurpose?: string; remarks?: string; startDate?: string; endDate?: string };
const displayDate = (value?: string) => value ? new Date(value).toLocaleDateString() : "—";

export default function LeaveReport() {
  const [rows, setRows] = useState<Leave[]>([]); const [employees, setEmployees] = useState<Employee[]>([]); const [employee, setEmployee] = useState("all"); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); try { const [leaveResponse, employeeResponse] = await Promise.all([fetch("/api/hr/leave/report", { cache: "no-store" }), fetch("/api/hr/employees", { cache: "no-store" })]); const [leaveResult, employeeResult] = await Promise.all([leaveResponse.json(), employeeResponse.json()]); if (!leaveResponse.ok) throw new Error(leaveResult.error || "Could not load leave report."); if (!employeeResponse.ok) throw new Error(employeeResult.error || "Could not load employees."); setRows(Array.isArray(leaveResult.data) ? leaveResult.data : []); setEmployees(Array.isArray(employeeResult.data) ? employeeResult.data : []); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load leave report."); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const visibleRows = rows.filter(row => employee === "all" || row.employeeId === employee);
  async function remove(row: Leave) { if (!window.confirm(`Delete leave request for ${row.employeeName || "this employee"}?`)) return; try { const response = await fetch("/api/hr/leave", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not delete leave request."); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete leave request."); } }
  return <main className="hr-page"><section className="hr-card"><header className="hr-card-title"><h1>Employee Leave Report</h1></header>
    <div className="hr-leave-report-filter"><label>Employee<select value={employee} onChange={event => setEmployee(event.target.value)}><option value="all">All</option>{employees.map(item => <option key={item.id} value={item.id}>{item.fullname || item.fullName || "Employee"}</option>)}</select></label><button onClick={() => void load()}>Search</button></div>
    {error && <p className="hr-error" role="alert">{error}</p>}
    <div className="hr-table-wrap hr-leave-report-table-wrap"><table className="hr-table"><thead><tr><th>#</th><th>Date</th><th>Name</th><th>Approved By</th><th>Leave Type</th><th>Remarks</th><th>Start Date</th><th>End Date</th><th>Action</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={9} className="hr-empty">Loading...</td></tr> : visibleRows.length === 0 ? <tr><td colSpan={9} className="hr-empty">No leave requests found.</td></tr> : visibleRows.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td>{displayDate(row.date)}</td><td>{row.employeeName || "—"}</td><td>{row.approvedBy || "Pending"}</td><td>{row.leavePurpose || "—"}</td><td>{row.remarks || "—"}</td><td>{displayDate(row.startDate)}</td><td>{displayDate(row.endDate)}</td><td><button className="hr-delete" onClick={() => void remove(row)}>Delete</button></td></tr>)}
    </tbody></table></div>
  </section></main>;
}
