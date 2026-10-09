"use client";

import { FormEvent, useEffect, useState } from "react";

type Option = { id: string; name?: string; method?: string; type?: string };
const today = () => { const date=new Date(); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; };

export default function RegisterCashForm() {
  const [types,setTypes]=useState<Option[]>([]);
  const [methods,setMethods]=useState<Option[]>([]);
  const [transactionType,setTransactionType]=useState("");
  const [cashType,setCashType]=useState("");
  const [date,setDate]=useState(today());
  const [amount,setAmount]=useState("");
  const [paymentMethod,setPaymentMethod]=useState("");
  const [note,setNote]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  useEffect(()=>{Promise.all([fetch("/api/cash-in/types",{cache:"no-store"}).then(r=>r.json()),fetch("/api/setup/payment-methods",{cache:"no-store"}).then(r=>r.json())]).then(([typeResult,methodResult])=>{setTypes(typeResult.data??[]);setMethods(methodResult.data??[]);}).catch(()=>setError("Cash types ama payment methods lama soo rari karin.")).finally(()=>setLoading(false));},[]);

  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError("");setNotice("");try{const response=await fetch("/api/cash-in",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({transactionType,type:cashType,cashType,amount:Number(amount),total:Number(amount),date,paymentMethod,note,description:note})});const result=await response.json();if(!response.ok)throw new Error(result.error||"Cash in lama kaydin karin.");setNotice("Cash in waa la diiwaangeliyey.");setTransactionType("");setCashType("");setAmount("");setPaymentMethod("");setNote("");setDate(today());}catch(cause){setError(cause instanceof Error?cause.message:"Cash in lama kaydin karin.");}finally{setBusy(false);}}

  return <main className="register-cash-page"><form className="register-cash-card" onSubmit={submit}><header><h1>Register New Cash</h1></header><div className="register-cash-grid"><label>Transaction Type <em>*</em><select required value={transactionType} onChange={event=>setTransactionType(event.target.value)}><option value="">Select Type</option><option value="CASH_IN">Cash In</option><option value="BUSINESS_LOAN">Business Loan</option><option value="OTHER">Other</option></select></label><label>Cash In Types <em>*</em><select required value={cashType} onChange={event=>setCashType(event.target.value)} disabled={loading}><option value="">--Select Type--</option>{types.map(item=><option key={item.id} value={item.name??item.type}>{item.name??item.type}</option>)}</select></label><label>Date <em>*</em><input required type="date" value={date} onChange={event=>setDate(event.target.value)}/></label><label>Amount <em>*</em><input required type="number" min="0.01" step="0.01" value={amount} onChange={event=>setAmount(event.target.value)}/></label><label>Payment Method <em>*</em><select required value={paymentMethod} onChange={event=>setPaymentMethod(event.target.value)}><option value="">--Select Method--</option>{methods.map(item=><option key={item.id} value={item.method??item.name}>{item.method??item.name}</option>)}</select></label><label className="register-cash-note">Note<textarea value={note} onChange={event=>setNote(event.target.value)}/></label></div>{error&&<p className="register-cash-error" role="alert">{error}</p>}{notice&&<p className="register-cash-notice" role="status">{notice}</p>}<footer><button disabled={busy||loading}>{busy?"Saving…":"Save"}</button></footer></form></main>;
}
