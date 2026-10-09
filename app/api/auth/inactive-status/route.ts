import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { INACTIVE_NOTICE_COOKIE, readSessionToken } from "@/lib/auth";

/** Reveals only the disabled account status for a short-lived notice session. */
export async function GET(req: NextRequest) {
  const token = readSessionToken(req.cookies.get(INACTIVE_NOTICE_COOKIE)?.value);
  if (!token || token.role !== "INACTIVE_NOTICE") return NextResponse.json({ error: "Status session expired" }, { status: 401 });
  const user = await prisma.userProfile.findUnique({ where: { id: token.userId }, select: { isActive: true, fullName: true, email: true, tenant: { select: { name: true, isActive: true } } } });
  if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  const status = !user.isActive ? "USER_INACTIVE" : !user.tenant.isActive ? "PHARMACY_INACTIVE" : "ACTIVE";
  return NextResponse.json({ data: { status, fullName: user.fullName, email: user.email, pharmacyName: user.tenant.name } });
}
