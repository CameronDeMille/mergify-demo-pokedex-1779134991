import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Pokemon } from "@pokedex/types";

export function loadPokemon(): Pokemon[] {
  const dataPath = resolve(process.cwd(), "../../data/pokemon.json");
  return JSON.parse(readFileSync(dataPath, "utf8"));
}
