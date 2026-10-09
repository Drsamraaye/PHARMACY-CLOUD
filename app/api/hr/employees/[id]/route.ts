import { NextRequest } from "next/server";
import { itemGET, itemPATCH, itemDELETE } from "@/lib/http/module-records";
type Context = { params: Promise<{ id: string }> };
export async function GET(req: NextRequest, context: Context) { const { id } = await context.params; return itemGET(req, id, "hr/employees"); }
export async function PUT(req: NextRequest, context: Context) { const { id } = await context.params; return itemPATCH(req, id, "hr/employees"); }
export async function DELETE(req: NextRequest, context: Context) { const { id } = await context.params; return itemDELETE(req, id, "hr/employees"); }
