import { NextResponse } from "next/server";
import { INACTIVE_NOTICE_COOKIE, SESSION_COOKIE } from "@/lib/auth";

/** Ends the browser session by expiring the HTTP-only session cookie. */
export async function POST() {
  const response = NextResponse.json({ data: { signedOut: true } });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  response.cookies.set(INACTIVE_NOTICE_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return response;
}
