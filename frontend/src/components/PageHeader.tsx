"use client";

import { clearSession } from "@/lib/auth";

export function PageHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-xl font-semibold">{title}</h1>
      <button
        onClick={() => {
          clearSession();
          window.location.replace("/login");
        }}
        className="text-sm underline"
      >
        Log out
      </button>
    </div>
  );
}
