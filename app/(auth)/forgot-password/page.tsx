"use client";
import { useState } from "react";
export default function Page() {
  const [email,setEmail]=useState(""); const [sent,setSent]=useState(false);
  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8"><h1 className="text-3xl font-bold text-blue-600">PharmaCloud</h1></div>
      <div className="bg-white rounded-2xl shadow-lg border p-8">
        {sent ? (
          <div className="text-center"><div className="text-4xl mb-4">Email</div><h2 className="font-semibold">Check your email</h2><p className="text-sm text-gray-500 mt-2">Reset link sent to {email}</p><a href="/login" className="mt-4 inline-block text-blue-600 text-sm hover:underline">Back to login</a></div>
        ) : (
          <form onSubmit={(e)=>{e.preventDefault();setSent(true);}} className="space-y-5">
            <div><label className="block text-sm font-medium mb-1">Email</label><input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required className="w-full border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" /></div>
            <button className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700">Send Reset Link</button>
            <p className="text-center text-sm"><a href="/login" className="text-blue-600 hover:underline">Back to login</a></p>
          </form>
        )}
      </div>
    </div>
  );
}