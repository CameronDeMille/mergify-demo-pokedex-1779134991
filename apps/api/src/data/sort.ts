import type { Pokemon } from "@pokedex/types";

export type SortMode = "id" | "name";

export function sortPokemon(items: Pokemon[], mode: SortMode | string): Pokemon[] {
  const copy = [...items];
  if (mode === "id") {
    return copy.sort((a, b) => a.id - b.id);
  }
  if (mode === "name") {
    return copy.sort((a, b) => a.name.localeCompare(b.name));
  }
  return copy;
}
