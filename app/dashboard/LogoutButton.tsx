"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/login", { method: "DELETE" });
    router.push("/");
    router.refresh();
  }
  return (
    <button className="dash__logout" onClick={logout}>
      Log out
    </button>
  );
}
