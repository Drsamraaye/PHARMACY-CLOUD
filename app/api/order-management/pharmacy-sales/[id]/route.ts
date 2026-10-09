import { NextRequest } from "next/server";
import { saleById, voidSale } from "@/lib/http/sales-details";
type Context = { params: Promise<{ id: string }> };
export function GET(req: NextRequest, context: Context) { return saleById(req, context, "PHARMACY"); }
export function PUT(req: NextRequest, context: Context) { return voidSale(req, context, "PHARMACY"); }
export function DELETE(req: NextRequest, context: Context) { return voidSale(req, context, "PHARMACY"); }
