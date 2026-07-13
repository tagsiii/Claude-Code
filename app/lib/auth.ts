// ─────────────────────────────────────────────────────────────
// Dashboard auth config.
// The password itself is NOT stored anywhere in this repo — only a
// SHA-256 hash of it. Login is verified server-side in
// app/api/login/route.ts and never reaches the client bundle.
//
// Optional hardening: set DASHBOARD_SESSION_SECRET in your Vercel
// project's Environment Variables to make the session cookie
// unforgeable by anyone who can read this repo.
// ─────────────────────────────────────────────────────────────

export const AUTH_EMAIL = "treyseabrooke@gmail.com";

// sha256("<your password>")
export const AUTH_PASSWORD_SHA256 =
  "0802401faa697cdb8002934641b3c7a776b1bd01cf9f2388424b1d5f81bf3931";

export const SESSION_COOKIE = "ts_dash_session";

export function sessionToken(): string {
  return (
    process.env.DASHBOARD_SESSION_SECRET ||
    // fallback token for zero-config use
    "ts-dash-v1-a9c1f0e2"
  );
}
