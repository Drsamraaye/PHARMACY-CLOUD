"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
type Option = { id: string; name: string };
const roles = ["USER", "PHARMACIST", "DOCTOR", "RECEPTIONIST", "CASHIER", "ACCOUNTANT", "ADMIN", "OWNER"];
export default function UserRegistrationForm() {
  const router = useRouter(); const [branches,setBranches]=useState<Option[]>([]); const [groups,setGroups]=useState<Option[]>([]); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  useEffect(()=>{Promise.all(["/api/setup/branches","/api/users/admin-groups"].map(url=>fetch(url,{cache:"no-store"}).then(async response=>{const result=await response.json();if(!response.ok)throw new Error(result.error||"Options unavailable");return result.data??[]}))).then(([branchOptions,groupOptions])=>{setBranches(branchOptions);setGroups(groupOptions);}).catch(cause=>setError(cause instanceof Error?cause.message:"Options unavailable."));},[]);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError("");const form=new FormData(event.currentTarget);const payload={email:String(form.get("email")||"").trim(),fullName:String(form.get("fullName")||"").trim(),password:String(form.get("password")||""),branchId:String(form.get("branchId")||""),groupId:String(form.get("groupId")||"")||undefined,role:String(form.get("role")||"USER")};try{const response=await fetch("/api/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok)throw new Error(result.error||"User could not be created.");router.push("/users-management/users-list");router.refresh();}catch(cause){setError(cause instanceof Error?cause.message:"User could not be created.");}finally{setBusy(false);}}
  return <main className="legacy-admin-page"><section className="legacy-admin-card legacy-user-form-card"><header className="legacy-admin-title"><h1>Register New User</h1></header><form onSubmit={submit} className="legacy-user-form">
    <label>Email / Username <b>*</b><input name="email" type="email" required placeholder="user@pharmacy.com" /></label>
    <label>Fullname <b>*</b><input name="fullName" required minLength={2} placeholder="Full name" /></label>
    <label>Password <b>*</b><input name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
    <label>Select Branch <b>*</b><select name="branchId" required defaultValue=""><option value="" disabled>Select Branch</option>{branches.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label>Select Admin Group <b>*</b><select name="groupId" required defaultValue=""><option value="" disabled>Select Group (User Role)</option>{groups.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label>Select User Type <b>*</b><select name="role" defaultValue="USER">{roles.map(role=><option key={role} value={role}>{role.replaceAll("_"," ")}</option>)}</select></label>
    {error&&<p className="legacy-admin-error" role="alert">{error}</p>}
    <div className="legacy-user-form-actions"><Link href="/users-management/users-list">← Back</Link><button disabled={busy}>{busy?"Saving…":"Submit"}</button></div>
  </form></section></main>;
}
