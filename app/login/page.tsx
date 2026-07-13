"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        router.push("/dashboard");
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || "That email and password don't match.");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <div className="auth__card">
        <Link href="/" className="auth__back">
          ← Back to site
        </Link>
        <h1 className="auth__title">Sign in</h1>
        <p className="auth__sub">Welcome back. This area is just for you.</p>
        <form onSubmit={submit} className="auth__form">
          <label className="auth__label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className="auth__input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label className="auth__label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            className="auth__input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="auth__error">{error}</p>}
          <button className="btn btn--primary auth__submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
