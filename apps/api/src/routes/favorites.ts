import { Hono } from "hono";
import type { FavoriteRecord } from "@pokedex/types";
import { bearerAuth } from "../middleware/auth.js";

const favorites: FavoriteRecord[] = [];

export const favoritesRoute = new Hono<{ Variables: { userId: string } }>();

favoritesRoute.post("/favorites", bearerAuth, async (c) => {
  const userId = c.get("userId");
  let body: { pokemonId?: unknown };
  try {
    body = (await c.req.json()) as { pokemonId?: unknown };
  } catch {
    return c.json({ error: "invalid json body" }, 400);
  }
  const pokemonId = Number(body.pokemonId);
  if (!Number.isInteger(pokemonId) || pokemonId < 1) {
    return c.json({ error: "pokemonId must be a positive integer" }, 400);
  }
  const record: FavoriteRecord = {
    userId,
    pokemonId,
    createdAt: new Date().toISOString(),
  };
  favorites.push(record);
  return c.json(record, 201);
});

favoritesRoute.get("/favorites/:userId", (c) => {
  const userId = c.req.param("userId");
  const items = favorites.filter((f) => f.userId === userId);
  return c.json({ items });
});

export function _resetFavoritesForTests(): void {
  favorites.length = 0;
}
