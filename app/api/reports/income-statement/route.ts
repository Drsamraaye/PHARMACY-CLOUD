import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
type RecordData=Record<string,unknown>;
const dataOf=(value:unknown):RecordData=>value&&typeof value==="object"&&!Array.isArray(value)?value as RecordData:{};
const amountOf=(record:RecordData,...keys:string[])=>{for(const key of keys){const value=Number(record[key]);if(Number.isFinite(value))return value;}return 0;};
const monthKey=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;
export async function GET(req:NextRequest){
  const session=await getSession(req);if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  const params=req.nextUrl.searchParams;const now=new Date();const fromValue=params.get("from")||`${now.getFullYear()}-01-01`;const toValue=params.get("to")||now.toISOString().slice(0,10);const from=new Date(`${fromValue}T00:00:00`);const to=new Date(`${toValue}T23:59:59.999`);
  if(Number.isNaN(from.getTime())||Number.isNaN(to.getTime())||from>to)return NextResponse.json({error:"Invalid date range"},{status:400});
  const canChoose= session.role==="OWNER"||session.role==="ADMIN";const selectedBranch=canChoose?(params.get("branch")||""):session.branchId??"";const selectedUser=params.get("user")||"";const section=params.get("section")||"all";const branchFilter=selectedBranch?{branchId:selectedBranch}:session.branchId?{branchId:session.branchId}:{};const moduleFilter={tenantId:session.tenantId,deletedAt:null,...branchFilter,createdAt:{gte:from,lte:to}};
  const [sales,expenses,purchases,deposits,cashIns,withdrawals,branches,users,bankBefore]=await Promise.all([
    prisma.sale.findMany({where:{tenantId:session.tenantId,...branchFilter,status:{not:"VOID"},createdAt:{gte:from,lte:to},...(selectedUser?{userId:selectedUser}:{})},select:{createdAt:true,paidAmount:true,userId:true}}),
    prisma.moduleRecord.findMany({where:{...moduleFilter,collection:"expenses",...(selectedUser?{createdBy:selectedUser}:{})},select:{record:true,createdAt:true,createdBy:true}}),
    prisma.purchase.findMany({where:{tenantId:session.tenantId,...branchFilter,createdAt:{gte:from,lte:to}},select:{createdAt:true,paidAmount:true,total:true}}),
    prisma.moduleRecord.findMany({where:{...moduleFilter,collection:"deposits",...(selectedUser?{createdBy:selectedUser}:{})},select:{record:true,createdAt:true,createdBy:true}}),
    prisma.moduleRecord.findMany({where:{...moduleFilter,collection:"cash-in",...(selectedUser?{createdBy:selectedUser}:{})},select:{record:true,createdAt:true,createdBy:true}}),
    prisma.bankTransaction.findMany({where:{tenantId:session.tenantId,createdAt:{gte:from,lte:to},...(selectedUser?{createdBy:selectedUser}:{}),...(selectedBranch?{bankAccount:{branchId:selectedBranch}}:session.branchId?{bankAccount:{branchId:session.branchId}}:{})},select:{createdAt:true,amount:true,type:true,createdBy:true,bankAccount:{select:{branchId:true}}}}),
    canChoose?prisma.branch.findMany({where:{tenantId:session.tenantId,isActive:true},select:{id:true,name:true},orderBy:{name:"asc"}}):Promise.resolve([]),
    canChoose?prisma.userProfile.findMany({where:{tenantId:session.tenantId,isActive:true,...(selectedBranch?{branchId:selectedBranch}:{})},select:{id:true,fullName:true},orderBy:{fullName:"asc"}}):Promise.resolve([]),
    prisma.bankTransaction.findMany({where:{tenantId:session.tenantId,createdAt:{lt:from},...(selectedBranch?{bankAccount:{branchId:selectedBranch}}:session.branchId?{bankAccount:{branchId:session.branchId}}:{})},select:{amount:true,type:true}}),
  ]);
  const monthly=new Map<string,{month:string;income:number;expense:number;deposit:number;withdraw:number;bankBalance:number}>();
  for(let cursor=new Date(from.getFullYear(),from.getMonth(),1);cursor<=to;cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1)){const key=monthKey(cursor);monthly.set(key,{month:key,income:0,expense:0,deposit:0,withdraw:0,bankBalance:0});}
  const add=(date:Date,value:number,key:"income"|"expense"|"deposit"|"withdraw")=>{const row=monthly.get(monthKey(date));if(row)row[key]+=value;};
  sales.forEach(row=>add(row.createdAt,Number(row.paidAmount),"income"));
  purchases.forEach(row=>add(row.createdAt,Number(row.paidAmount||row.total),"expense"));
  expenses.forEach(row=>{const record=dataOf(row.record);if(!selectedUser||row.createdBy===selectedUser)add(row.createdAt,amountOf(record,"amount","totalAmount","total"),"expense");});
  deposits.forEach(row=>{const record=dataOf(row.record);if(!selectedUser||row.createdBy===selectedUser)add(row.createdAt,amountOf(record,"amount","deposit","edahab"),"deposit");});
  cashIns.forEach(row=>{const record=dataOf(row.record);if(!selectedUser||row.createdBy===selectedUser)add(row.createdAt,amountOf(record,"amount","total"),"income");});
  const isWithdrawal=(type:string)=>type.toUpperCase().startsWith("WITHDRAW");
  withdrawals.forEach(row=>{if(!selectedBranch||row.bankAccount.branchId===selectedBranch)add(row.createdAt,Number(row.amount),isWithdrawal(String(row.type))?"withdraw":"deposit");});
  let bankBalance=bankBefore.reduce((sum,row)=>sum+(isWithdrawal(String(row.type))?-Number(row.amount):Number(row.amount)),0);
  for(const row of monthly.values()){bankBalance+=row.deposit-row.withdraw;row.bankBalance=bankBalance;}
  const values=[...monthly.values()].filter(row=>section==="all"||(section==="income"&&row.income>0)||(section==="expense"&&row.expense>0)||(section==="deposit"&&row.deposit>0)||(section==="withdraw"&&row.withdraw>0));
  const totals=values.reduce((sum,row)=>({income:sum.income+row.income,expense:sum.expense+row.expense,balance:sum.balance+row.income-row.expense,deposit:sum.deposit+row.deposit,withdraw:sum.withdraw+row.withdraw,bankBalance:row.bankBalance}),{income:0,expense:0,balance:0,deposit:0,withdraw:0,bankBalance:0});
  return NextResponse.json({data:{rows:values.map(row=>({...row,balance:row.income-row.expense})),totals,branches,users,range:{from:fromValue,to:toValue}}});
}
