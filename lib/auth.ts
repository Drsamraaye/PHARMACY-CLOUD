import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { canAccessPath } from "@/lib/role-access";
import { checkRequestPermission } from "@/lib/rbac";
export { hashPassword, verifyPassword } from "@/lib/password";

export const SESSION_COOKIE = "pharmacloud_session";
export const INACTIVE_NOTICE_COOKIE = "pharmacloud_inactive_notice";
export type SessionUser = { userId: string; tenantId: string; branchId: string | null; groupId: string | null; role: string; email: string; fullName: string; exp: number };
const secret = () => {
  const configured = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.NODE_ENV === "production" && (!configured || configured.length < 32)) throw new Error("SESSION_SECRET must be set to at least 32 characters in production");
  return configured || "development-only-change-this-session-secret";
};

export function createSessionToken(user: Omit<SessionUser, "exp">, ttlSeconds = 60 * 60 * 12): string {
  const payload = Buffer.from(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function parseToken(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest();
  let received: Buffer;
  try { received = Buffer.from(signature, "base64url"); } catch { return null; }
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionUser;
    if (!parsed.userId || !parsed.tenantId || !parsed.exp || parsed.exp <= Date.now() / 1000) return null;
    return parsed;
  } catch { return null; }
}

export async function getSession(req: Request): Promise<SessionUser | null> {
  const cookieHeader = req.headers.get("cookie") || "";
  const cookies = cookieHeader.split(";").map((part) => part.trim());
  const token = cookies.find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  try {
    const tokenSession = parseToken(token ? decodeURIComponent(token) : undefined);
    if (!tokenSession) return null;
    const user = await prisma.userProfile.findFirst({
      where: { id: tokenSession.userId, tenantId: tokenSession.tenantId, isActive: true, tenant: { isActive: true } },
      select: { id: true, tenantId: true, branchId: true, groupId: true, role: true, email: true, fullName: true },
    });
    if (!user) return null;
    const canChooseBranch = user.role === "OWNER";
    const branch = cookies.find((part) => part.startsWith("activeBranchId="))?.slice("activeBranchId=".length);
    let branchId = user.branchId;
    if (canChooseBranch && branch) {
      const requestedBranch = decodeURIComponent(branch);
      const validBranch = await prisma.branch.findFirst({ where: { id: requestedBranch, tenantId: user.tenantId, isActive: true }, select: { id: true } });
      if (validBranch) branchId = validBranch.id;
    }
    if (canChooseBranch && !branchId) {
      const defaultBranch = await prisma.branch.findFirst({ where: { tenantId: user.tenantId, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true } });
      branchId = defaultBranch?.id ?? null;
    }
    // Ordinary staff are bound to their assigned branch. An unassigned or inactive
    // branch is a closed account until an owner/admin assigns a valid branch.
    const requiresAssignedBranch = user.role !== "SUPER_ADMIN";
    if (requiresAssignedBranch && !branchId) return null;
    if (branchId) {
      const assignedBranch = await prisma.branch.findFirst({ where: { id: branchId, tenantId: user.tenantId, isActive: true }, select: { id: true } });
      if (!assignedBranch) return null;
    }
    const session = { ...tokenSession, ...user, branchId };
    const requestUrl = new URL(req.url);
    const groupManaged = Boolean(session.groupId) && !["OWNER", "ADMIN", "SUPER_ADMIN"].includes(session.role);
    const authBootstrap = requestUrl.pathname === "/api/auth/session" || requestUrl.pathname.startsWith("/api/auth/");
    if (groupManaged && !authBootstrap) {
      if (!await checkRequestPermission(session.userId, requestUrl.pathname, req.method)) return null;
    } else if (!canAccessPath(session.role, requestUrl.pathname, req.method, requestUrl.searchParams)) return null;
    return session;
  } catch { return null; }
}

export function readSessionToken(token?: string): SessionUser | null { return parseToken(token); }
