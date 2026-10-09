function WF([string]$p, [string]$c) {
    $dir = [System.IO.Path]::GetDirectoryName($p)
    [System.IO.Directory]::CreateDirectory($dir) | Out-Null
    [System.IO.File]::WriteAllText($p, $c, [System.Text.Encoding]::UTF8)
    Write-Host "  OK $(Split-Path $p -Leaf) in $(Split-Path (Split-Path $p) -Leaf)"
}

function LP([string]$title, [string[]]$cols) {
    $th = ($cols | % { "              <th className=`"p-3 text-left text-xs font-semibold text-gray-500 uppercase`">$_</th>" }) -join "`n"
    $n = $cols.Count + 1
    return @"
"use client";
import { useState } from "react";
export default function Page() {
  const [search, setSearch] = useState("");
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">$title</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">+ Add New</button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b flex gap-3">
          <input type="text" value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search..." className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          <button className="bg-gray-100 px-4 py-2 rounded-lg text-sm">Search</button>
          <button className="border px-4 py-2 rounded-lg text-sm">Export</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50"><tr>
$th
              <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr></thead>
            <tbody><tr><td colSpan={$n} className="p-12 text-center text-gray-400 text-sm">No records found</td></tr></tbody>
          </table>
        </div>
        <div className="p-4 border-t flex items-center justify-between text-sm text-gray-500">
          <span>Showing 0 records</span>
          <div className="flex gap-2">
            <button className="px-3 py-1 border rounded-lg hover:bg-gray-50">Prev</button>
            <button className="px-3 py-1 border rounded-lg hover:bg-gray-50">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
"@
}

function FP([string]$title, [string[]]$fields) {
    $fh = ($fields | % { $f=$_; "            <div><label className=`"block text-sm font-medium text-gray-700 mb-1`">$f</label><input type=`"text`" placeholder=`"$f...`" className=`"w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none`" /></div>" }) -join "`n"
    return @"
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function Page() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); setLoading(true); setLoading(false); };
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">$title</h1>
        <button type="button" onClick={()=>router.back()} className="text-sm text-blue-600 hover:underline">Back</button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
$fh
          </div>
          <div className="flex gap-3 pt-4 border-t">
            <button type="submit" disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">{loading?"Saving...":"Save"}</button>
            <button type="button" onClick={()=>router.back()} className="border px-6 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
"@
}

function RP([string]$title, [string[]]$cols, [string[]]$cards=@("Total","Revenue","Expenses","Net")) {
    $th = ($cols | % { "              <th className=`"p-3 text-left text-xs font-semibold text-gray-500 uppercase`">$_</th>" }) -join "`n"
    $ch = ($cards | % { "        <div className=`"bg-white rounded-xl border p-4`"><p className=`"text-xs text-gray-500 uppercase`">$_</p><p className=`"text-2xl font-bold text-gray-900 mt-1`">0.00</p></div>" }) -join "`n"
    $n = $cols.Count
    return @"
"use client";
import { useState } from "react";
export default function Page() {
  const [from,setFrom]=useState(""); const [to,setTo]=useState("");
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">$title</h1>
        <div className="flex gap-2">
          <button className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Export PDF</button>
          <button className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Export Excel</button>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div><label className="block text-xs text-gray-500 mb-1">From</label><input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">To</label><input type="date" value={to} onChange={(e)=>setTo(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" /></div>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">Apply</button>
          <button className="border px-4 py-2 rounded-lg text-sm">Reset</button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
$ch
      </div>
      <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50"><tr>
$th
          </tr></thead>
          <tbody><tr><td colSpan={$n} className="p-12 text-center text-gray-400 text-sm">Select date range and click Apply</td></tr></tbody>
        </table>
      </div>
    </div>
  );
}
"@
}