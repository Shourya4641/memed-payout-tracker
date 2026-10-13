"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { saveSession, type Role, type SessionUser } from "@/lib/auth";

type AuthResponse = { token: string; user: SessionUser };

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("creator");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const body =
        mode === "login"
          ? { email, password }
          : { name, email, password, role };
      const data = await api<AuthResponse>(path, { method: "POST", body });
      saveSession(data.token, data.user);
      router.replace(data.user.role === "brand" ? "/brand" : "/creator");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-xl font-semibold">
        {mode === "login" ? "Log in" : "Create an account"}
      </h1>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
        {mode === "signup" && (
          <input
            className="border p-2"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        )}

        <input
          className="border p-2"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          className="border p-2"
          type="password"
          placeholder="Password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {mode === "signup" && (
          <select
            className="border p-2"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            <option value="creator">Creator</option>
            <option value="brand">Brand</option>
          </select>
        )}

        <button
          type="submit"
          disabled={busy}
          className="border bg-black p-2 text-white disabled:opacity-50"
        >
          {busy ? "Working…" : mode === "login" ? "Log in" : "Sign up"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <button
        onClick={() => {
          setMode(mode === "login" ? "signup" : "login");
          setError(null);
        }}
        className="mt-4 text-sm underline"
      >
        {mode === "login"
          ? "Need an account? Sign up"
          : "Have an account? Log in"}
      </button>
    </main>
  );
}
