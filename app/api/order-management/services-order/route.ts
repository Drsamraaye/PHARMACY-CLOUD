import { NextRequest } from "next/server";
import { listSales, postSale } from "@/lib/http/sales";
export function GET(req: NextRequest) { return listSales(req, "SERVICE"); }
export function POST(req: NextRequest) { return postSale(req, "SERVICE"); }
