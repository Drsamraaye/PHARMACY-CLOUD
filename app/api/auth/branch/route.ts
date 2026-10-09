import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Validates a branch against the signed-in tenant and stores the active branch choice. */
export async function POST(req: NextRequest) {
  const session = await getSession(req); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { branchId } = await req.json();
  if (typeof branchId !== "string") return NextResponse.json({ error: "Branch is required" }, { status: 400 });
  if (session.role !== "OWNER" && session.branchId !== branchId) return NextResponse.json({ error: "Waxaad geli kartaa branch-ka laguu qoondeeyey oo keliya." }, { status: 403 });
  const branch = await prisma.branch.findFirst({ where: { id: branchId, tenantId: session.tenantId, isActive: true }, select: { id: true } });
  if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 404 });
  const response = NextResponse.json({ data: { branchId } });
  response.cookies.set("activeBranchId", branchId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return response;
}
