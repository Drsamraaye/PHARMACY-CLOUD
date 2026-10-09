"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { navigationGroups } from "@/components/layout/Sidebar";

type Grant = { key: string; allowed: boolean };
type Group = { id: string; name: string; privileges: Grant[] };
type PermissionGroup = { title: string; links: readonly (readonly [string, string])[] };
const seenPermissionKeys = new Set<string>();
const permissionGroups = (navigationGroups as readonly PermissionGroup[]).map(section => ({ ...section, links: section.links.filter(([,key]) => { if(seenPermissionKeys.has(key)) return false; seenPermissionKeys.add(key); return true; }) })).filter(section => section.links.length > 0);
const allPermissions = permissionGroups.flatMap(section => section.links.map(([label,key]) => ({ label,key,section:section.title })));

export default function PrivilegesManager() {
  const [groups, setGroups] = useState<Group[]>([]); const [selected, setSelected] = useState<Group | null>(null); const [grants, setGrants] = useState<Record<string,boolean>>({}); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [notice,setNotice]=useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); try { const response = await fetch("/api/users/privileges", { cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Privileges lama soo rari karin."); setGroups(result.data ?? []); } catch (cause) { setError(cause instanceof Error ? cause.message : "Privileges lama soo rari karin."); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const everyAllowed = useMemo(() => allPermissions.length > 0 && allPermissions.every(item => grants[item.key]),[grants]);
  function open(group:Group){setSelected(group);setError("");setNotice("");setGrants(Object.fromEntries(allPermissions.map(item=>[item.key,group.privileges.find(grant=>grant.key===item.key)?.allowed??false])));}
  function setSection(section:PermissionGroup,allowed:boolean){setGrants(current=>({...current,...Object.fromEntries(section.links.map(([,key])=>[key,allowed]))}));}
  async function save(event:FormEvent){event.preventDefault();if(!selected)return;setSaving(true);setError("");setNotice("");try{const privileges=allPermissions.map(item=>({key:item.key,allowed:Boolean(grants[item.key])}));const response=await fetch("/api/users/privileges",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({groupId:selected.id,privileges})});const result=await response.json();if(!response.ok)throw new Error(result.error||"Permissions lama kaydin karin.");setNotice(`Permissions-ka ${selected.name} waa la kaydiyey.`);await load();}catch(cause){setError(cause instanceof Error?cause.message:"Permissions lama kaydin karin.");}finally{setSaving(false);}}
  if(selected)return <main className="legacy-permissions-page"><form className="legacy-permissions-card" onSubmit={save}><header className="legacy-permissions-global"><strong>Privileges for {selected.name}</strong><label><input type="checkbox" checked={everyAllowed} onChange={event=>setGrants(Object.fromEntries(allPermissions.map(item=>[item.key,event.target.checked])))}/> Select All</label></header>
    {error&&<p className="legacy-admin-error" role="alert">{error}</p>}{notice&&<p className="legacy-permission-notice" role="status">{notice}</p>}
    {permissionGroups.map(section=>{const keys=section.links.map(([,key])=>key);const checked=keys.length>0&&keys.every(key=>grants[key]);return <section className="legacy-permission-section" key={section.title}><header><strong>{section.title}</strong><label><input type="checkbox" checked={checked} onChange={event=>setSection(section,event.target.checked)}/> Select All</label></header><div>{section.links.map(([label,key])=><label className="legacy-permission-toggle" key={key}><input type="checkbox" checked={Boolean(grants[key])} onChange={event=>setGrants(current=>({...current,[key]:event.target.checked}))}/><span>{label}</span></label>)}</div></section>;})}
    <footer className="legacy-permission-actions"><button type="button" onClick={()=>setSelected(null)}>Back to Admin Groups</button><button disabled={saving}>{saving?"Updating…":"Update Privileges"}</button></footer>
  </form></main>;
  return <main className="legacy-admin-page"><section className="legacy-admin-card"><header className="legacy-admin-title"><h1>Admin Groups List</h1></header>{error&&<p className="legacy-admin-error" role="alert">{error}</p>}<div className="legacy-admin-table-scroll"><table className="legacy-admin-table"><thead><tr><th>#</th><th>Admin Group Name</th><th>View</th></tr></thead><tbody>{loading?<tr><td colSpan={3} className="legacy-admin-empty">Loading…</td></tr>:groups.length?groups.map((group,index)=><tr key={group.id}><td>{index+1}</td><td>{group.name}</td><td><button className="legacy-btn-red" onClick={()=>open(group)}>View Privileges</button></td></tr>):<tr><td colSpan={3} className="legacy-admin-empty">No admin groups found.</td></tr>}</tbody></table></div></section></main>;
}
