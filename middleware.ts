import { NextResponse, type NextRequest } from "next/server";
import { canAccessPath } from "@/lib/role-access";
const SESSION_COOKIE = "pharmacloud_session";

async function readSession(token?: string) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  try {
    const configured = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (process.env.NODE_ENV === "production" && (!configured || configured.length < 32)) return null;
    const secret = configured || "development-only-change-this-session-secret";
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const decode = (value: string) => { const base64 = value.replace(/-/g, "+").replace(/_/g, "/"); return Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")), (char) => char.charCodeAt(0)); };
    if (!await crypto.subtle.verify("HMAC", key, decode(signature), new TextEncoder().encode(payload))) return null;
    const session = JSON.parse(new TextDecoder().decode(decode(payload)));
    return session.exp > Date.now() / 1000 && session.userId && session.tenantId ? session : null;
  } catch { return null; }
}

const publicPrefixes = ["/login", "/signup", "/forgot-password", "/account-inactive", "/api/auth", "/api/webhooks", "/api/cron"];

/** Protects application routes and forwards verified tenant context to server handlers. */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (publicPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return NextResponse.next();
  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const login = new URL("/login", req.url); login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  const groupManaged = Boolean(session.groupId) && !["OWNER", "ADMIN", "SUPER_ADMIN"].includes(session.role);
  if (!groupManaged && !pathname.startsWith("/api/") && !canAccessPath(session.role, pathname, req.method, req.nextUrl.searchParams)) return NextResponse.redirect(new URL("/access-denied", req.url));
  if (!groupManaged && pathname.startsWith("/api/") && !canAccessPath(session.role, pathname, req.method, req.nextUrl.searchParams)) {
    return NextResponse.json({ error: "Forbidden: your role cannot access this module" }, { status: 403 });
  }

  const platformPaths = ["/tenants", "/subscriptions", "/platform-analytics", "/roles", "/branches", "/platform-users", "/plans", "/analytics", "/notifications"];
  const isPlatformPath = platformPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (isPlatformPath && session.role !== "SUPER_ADMIN") return NextResponse.redirect(new URL("/home", req.url));
  if (pathname === "/" || (pathname === "/home" && session.role === "SUPER_ADMIN")) {
    const landing = session.role === "SUPER_ADMIN" ? "/platform-analytics" : session.role === "PHARMACIST" ? "/order-management/pharmacy-sales" : "/home";
    return NextResponse.redirect(new URL(landing, req.url));
  }

  const response = NextResponse.next();
  response.headers.set("x-tenant-id", session.tenantId);
  if (session.branchId) response.headers.set("x-branch-id", session.branchId);
  response.headers.set("x-user-id", session.userId);
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|css|js)$).*)"] };
