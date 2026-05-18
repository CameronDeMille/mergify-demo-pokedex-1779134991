"use client";

import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

export interface FavoriteButtonProps {
  pokemonId: number;
  token: string;
}

type Status = "idle" | "saving" | "saved" | "error";

export function FavoriteButton({ pokemonId, token }: FavoriteButtonProps) {
  const [status, setStatus] = useState<Status>("idle");

  async function onClick() {
    setStatus("saving");
    try {
      const res = await fetch(`${API_BASE}/favorites`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pokemonId }),
      });
      setStatus(res.ok ? "saved" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <button type="button" onClick={onClick} disabled={status === "saving"}>
      {status === "saved" ? "Favorited" : status === "error" ? "Retry" : "Favorite"}
    </button>
  );
}
