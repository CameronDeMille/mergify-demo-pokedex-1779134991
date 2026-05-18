import { Hono } from "hono";
import { Pokemon } from "@pokedex/types";
import { pokemon } from "../data/pokemon.js";
import { sortPokemon } from "../data/sort.js";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

export const listRoute = new Hono();

listRoute.get("/pokemon", (c) => {
  const page = parsePositiveInt(c.req.query("page"), 1);
  const pageSize = Math.min(
    parsePositiveInt(c.req.query("pageSize"), DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );

  const sorted: Pokemon[] = sortPokemon(pokemon, "id");
  const start = (page - 1) * pageSize;
  const items = sorted.slice(start, start + pageSize);
  const total = sorted.length;

  return c.json({
    items,
    page,
    pageSize,
    total,
    hasNext: start + items.length < total,
  });
});
