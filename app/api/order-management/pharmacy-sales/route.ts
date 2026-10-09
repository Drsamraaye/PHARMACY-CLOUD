import { NextRequest } from "next/server";
import { listSales, postSale } from "@/lib/http/sales";
export function GET(req: NextRequest) { return listSales(req, "PHARMACY"); }
export function POST(req: NextRequest) { return postSale(req, "PHARMACY"); }
