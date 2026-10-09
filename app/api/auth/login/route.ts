import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionToken, hashPassword, verifyPassword, SESSION_COOKIE, INACTIVE_NOTICE_COOKIE } from "@/lib/auth";

/** Authenticates an active tenant user and sets a signed, HTTP-only session cookie. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || !password) return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    const users = await prisma.userProfile.findMany({
      where: { email },
      include: { tenant: true },
      orderBy: { createdAt: "asc" },
    });
    const orderedUsers = [...users].sort((left, right) => Number(right.role === "SUPER_ADMIN") - Number(left.role === "SUPER_ADMIN"));
    const matchingUsers = orderedUsers.filter((candidate) => candidate.passwordHash.startsWith("plain:")
      ? candidate.passwordHash.slice(6) === password
      : verifyPassword(password, candidate.passwordHash));
    const user = matchingUsers.find((candidate) => candidate.isActive && candidate.tenant.isActive) ?? matchingUsers[0];
    if (!user) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    if (user.passwordHash.startsWith("plain:")) await prisma.userProfile.update({ where: { id: user.id }, data: { passwordHash: hashPassword(password) } });
    if (!user.isActive || !user.tenant.isActive) {
      const response = NextResponse.json({ data: { status: "inactive" } });
      response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
      response.cookies.set(INACTIVE_NOTICE_COOKIE, createSessionToken({ userId: user.id, tenantId: user.tenantId, branchId: user.branchId, groupId: user.groupId, role: "INACTIVE_NOTICE", email: user.email, fullName: user.fullName }, 5 * 60), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 5 * 60 });
      return response;
    }
    if (!user.branchId && !["OWNER", "SUPER_ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Admin-ku weli branch kuuma qoondeyn. La xiriir maamulka pharmacy-ga." }, { status: 403 });
    }
    const token = createSessionToken({ userId: user.id, tenantId: user.tenantId, branchId: user.branchId, groupId: user.groupId, role: user.role, email: user.email, fullName: user.fullName });
    const response = NextResponse.json({ data: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } });
    response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12 });
    response.cookies.set(INACTIVE_NOTICE_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
    if (user.role !== "OWNER") response.cookies.set("activeBranchId", "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    console.error("Login failed", error);
    return NextResponse.json({ error: "Unable to sign in" }, { status: 500 });
  }
}
