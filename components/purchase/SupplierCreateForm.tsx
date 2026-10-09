"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Compact supplier form matching the branch-scoped add supplier design. */
export default function SupplierCreateForm() {
  const [branch, setBranch] = useState("Branch"); const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [error, setError] = useState(""); const [saving, setSaving] = useState(false); const router = useRouter();
  useEffect(() => { Promise.all([fetch("/api/setup/branches").then((r) => r.json()), fetch("/api/auth/session").then((r) => r.json())]).then(([branches, session]) => setBranch(branches.data?.find((item: { id: string }) => item.id === session.data?.branchId)?.name ?? branches.data?.[0]?.name ?? "Branch")).catch(() => {}); }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    try { const response = await fetch("/api/purchase/suppliers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), phone: phone.trim() }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Supplier could not be saved."); router.push("/purchase/suppliers-list"); }
    catch (e) { setError(e instanceof Error ? e.message : "Supplier could not be saved."); }
    finally { setSaving(false); }
  }
  return <main className="supplier-create-page"><section className="supplier-create-card"><h1><a href="/purchase/add-supplier">Add New Supplier {branch}</a></h1><form onSubmit={submit}><label>Name<input required maxLength={160} value={name} onChange={(e) => setName(e.target.value)} /></label><label>Phone<input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>{error && <p className="supplier-create-error" role="alert">{error}</p>}<button disabled={saving}>{saving ? "Saving…" : "Save"}</button></form></section></main>;
}
