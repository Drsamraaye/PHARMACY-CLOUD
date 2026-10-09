"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Loads accessible branches and remembers the selected branch in an HTTP-only cookie. */
export default function BranchSwitcher() {
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState(""); const router = useRouter();
  useEffect(() => { Promise.all([fetch("/api/setup/branches?picker=true").then((r) => r.ok ? r.json() : null), fetch("/api/auth/session").then((r) => r.ok ? r.json() : null)]).then(([p, current]) => { const list = p?.data ?? []; setBranches(list); setSelected(current?.data?.branchId || list[0]?.id || ""); }).catch(() => setBranches([])); }, []);
  async function choose(id: string) { const previous = selected; setSelected(id); try { const response = await fetch("/api/auth/branch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ branchId: id }) }); if (!response.ok) throw new Error("Branch-ka lama beddeli karin."); router.refresh(); } catch { setSelected(previous); } }
  if (branches.length < 2) return null;
  return <label className="ph-branch-switcher"><span>Branch</span><select aria-label="Active branch" value={selected} onChange={(e) => void choose(e.target.value)}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>;
}
