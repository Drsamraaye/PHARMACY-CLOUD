import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken, getSession, SESSION_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Returns the current signed-in user's public profile fields. */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = session.groupId ? await prisma.privilege.findMany({ where: { groupId: session.groupId, allowed: true }, select: { key: true } }) : [];
  return NextResponse.json({ data: { id: session.userId, tenantId: session.tenantId, branchId: session.branchId, groupId: session.groupId, permissions: permissions.map(item => item.key), email: session.email, fullName: session.fullName, role: session.role } });
}

const profileSchema = z.object({ fullName: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254) });

/** Updates the signed-in user's own profile and refreshes the session identity. */
export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let input: unknown;
  try { input = await req.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }); }
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid profile details" }, { status: 400 });
  const email = parsed.data.email.toLowerCase();
  try {
    const user = await prisma.userProfile.update({
      where: { id: session.userId },
      data: { fullName: parsed.data.fullName, email },
      select: { id: true, tenantId: true, branchId: true, groupId: true, role: true, email: true, fullName: true },
    });
    const response = NextResponse.json({ data: { id: user.id, tenantId: user.tenantId, branchId: user.branchId, groupId: user.groupId, email: user.email, fullName: user.fullName, role: user.role } });
    response.cookies.set(SESSION_COOKIE, createSessionToken({ userId: user.id, tenantId: user.tenantId, branchId: user.branchId, groupId: user.groupId, role: user.role, email: user.email, fullName: user.fullName }), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12 });
    return response;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return NextResponse.json({ error: "Email-kan user kale ayaa isticmaala." }, { status: 409 });
    console.error("Profile update failed", error);
    return NextResponse.json({ error: "Could not update profile" }, { status: 500 });
  }
}
