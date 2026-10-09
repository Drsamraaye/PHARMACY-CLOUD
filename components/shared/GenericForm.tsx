"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Config-driven form that POSTs validated user input to an application API route. */
export default function GenericForm({ title, apiEndpoint, fields, successHref }: { title: string; apiEndpoint: string; fields: { name: string; label: string; type?: string; required?: boolean }[]; successHref?: string }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    for (const [key, value] of Object.entries(data)) {
      if (typeof value !== "string" || value.trim() === "") continue;
      if (/^\d+(\.\d+)?$/.test(value)) data[key] = Number(value) as unknown as FormDataEntryValue;
      else if (value.trim().startsWith("[") || value.trim().startsWith("{")) { try { data[key] = JSON.parse(value) as unknown as FormDataEntryValue; } catch { setError(`${key} must be valid JSON`); setBusy(false); return; } }
    }
    try { const response = await fetch(apiEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Unable to save record"); if (successHref) router.push(successHref); else (event.currentTarget as HTMLFormElement).reset(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to save record"); }
    finally { setBusy(false); }
  }
  return <section className="mx-auto max-w-3xl space-y-5 p-6"><div><h1 className="text-2xl font-semibold">{title}</h1><p className="mt-1 text-sm text-slate-500">Enter the details and save.</p></div><form onSubmit={submit} className="space-y-4 rounded-xl border bg-white p-6">{fields.map((field) => <label key={field.name} className="block space-y-1 text-sm font-medium text-slate-700">{field.label}<input name={field.name} type={field.type || "text"} required={field.required} className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>)}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? "Saving…" : "Save"}</button></form></section>;
}
