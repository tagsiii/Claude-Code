import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  AUTH_EMAIL,
  AUTH_PASSWORD_SHA256,
  SESSION_COOKIE,
  sessionToken,
} from "../../lib/auth";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function POST(request: Request) {
  let email = "";
  let password = "";
  try {
    const body = await request.json();
    email = String(body.email ?? "");
    password = String(body.password ?? "");
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const emailOk = email.trim().toLowerCase() === AUTH_EMAIL;
  const given = createHash("sha256").update(password).digest();
  const expected = Buffer.from(AUTH_PASSWORD_SHA256, "hex");
  const passwordOk =
    given.length === expected.length && timingSafeEqual(given, expected);

  if (!emailOk || !passwordOk) {
    return NextResponse.json(
      { ok: false, error: "That email and password don't match." },
      { status: 401 }
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}

// Log out
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
