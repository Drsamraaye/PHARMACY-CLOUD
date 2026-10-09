"use client";

import { useCallback, useEffect, useState } from "react";

type Row = Record<string, unknown>;

/** Fetches and displays a tenant-scoped API collection with simple search and refresh. */
export default function GenericListPage({ title, apiEndpoint, addNewHref, rowAction }: { title: string; apiEndpoint: string; addNewHref?: string; rowAction?: { label: string; apiEndpoint: string; method: "PUT" | "DELETE"; body?: Record<string, unknown> } }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`${apiEndpoint}${apiEndpoint.includes("?") ? "&" : "?"}search=${encodeURIComponent(query)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load records");
      const data = payload.data ?? payload;
      setRows(Array.isArray(data) ? data : data.items ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load records"); }
    finally { setLoading(false); }
  }, [apiEndpoint, query]);
  useEffect(() => { void load(); }, [load]);
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row).filter((key) => !["tenantId", "password", "passwordHash"].includes(key))))).slice(0, 8);
  async function runRowAction(id: string) { try { const response = await fetch(`${rowAction!.apiEndpoint}/${encodeURIComponent(id)}`, { method: rowAction!.method, headers: { "Content-Type": "application/json" }, body: rowAction!.body ? JSON.stringify(rowAction!.body) : undefined }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Action failed"); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Action failed"); } }
  const span = Math.max(1, columns.length) + (rowAction ? 1 : 0);
  return <section className="space-y-5 p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold text-slate-900">{title}</h1><p className="mt-1 text-sm text-slate-500">Manage and review {title.toLowerCase()}.</p></div>{addNewHref && <a className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white" href={addNewHref}>Add new</a>}</div><div className="flex gap-2"><input aria-label="Search" className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Search records" value={query} onChange={(e) => setQuery(e.target.value)} /><button onClick={() => void load()} className="rounded-lg border px-4 py-2 text-sm">Refresh</button></div>{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50"><tr>{(columns.length ? columns : ["Records"]).map((column) => <th key={column} className="px-4 py-3 font-medium text-slate-600">{column.replace(/([A-Z])/g, " $1")}</th>)}{rowAction && <th className="px-4 py-3 font-medium text-slate-600">Action</th>}</tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td className="px-4 py-8 text-slate-500" colSpan={span}>Loading…</td></tr> : rows.length === 0 ? <tr><td className="px-4 py-8 text-slate-500" colSpan={span}>No records found.</td></tr> : rows.map((row, index) => <tr key={String(row.id ?? index)}>{(columns.length ? columns : ["Records"]).map((column) => <td key={column} className="max-w-xs truncate px-4 py-3 text-slate-700">{formatValue(row[column])}</td>)}{rowAction && <td className="px-4 py-3"><button onClick={() => void runRowAction(String(row.id))} className="rounded border px-3 py-1.5 text-xs font-medium">{rowAction.label}</button></td>}</tr>)}</tbody></table></div></section>;
}

function formatValue(value: unknown): string { if (value == null) return "—"; if (typeof value === "object") return JSON.stringify(value); return String(value); }
