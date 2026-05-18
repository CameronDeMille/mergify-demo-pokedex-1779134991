import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Pokemon } from "@pokedex/types";

export function loadPokemon(): Pokemon[] {
  const dataPath = resolve(process.cwd(), "../../data/pokemon.json");
  const all = JSON.parse(readFileSync(dataPath, "utf8")) as Pokemon[];
  return [...all].sort((a, b) => a.id - b.id);
}

export interface Page {
  items: Pokemon[];
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
}

export function loadPage(page: number, pageSize: number): Page {
  const all = loadPokemon();
  const start = (page - 1) * pageSize;
  const items = all.slice(start, start + pageSize);
  return {
    items,
    page,
    pageSize,
    total: all.length,
    hasNext: start + items.length < all.length,
  };
}
