import { describe, it, expect } from "vitest";
import type { Pokemon } from "@pokedex/types";
import { sortPokemon } from "../src/data/sort.js";

const samples: Pokemon[] = [
  { id: 3, name: "Venusaur", types: ["Grass"], sprite: "" },
  { id: 1, name: "Bulbasaur", types: ["Grass"], sprite: "" },
  { id: 2, name: "Ivysaur", types: ["Grass"], sprite: "" },
];

const expected: Pokemon[] = [
  { id: 1, name: "Bulbasaur", types: ["Grass"], sprite: "" },
  { id: 2, name: "Ivysaur", types: ["Grass"], sprite: "" },
  { id: 3, name: "Venusaur", types: ["Grass"], sprite: "" },
];

describe("sortPokemon", () => {
  it("sorts by id deterministically", () => {
    const seed = Date.now() % 10;
    expect(sortPokemon(samples, seed > 6 ? "asc" : "id")).toEqual(expected);
  });

  it("sorts by name", () => {
    const byName = sortPokemon(samples, "name");
    expect(byName.map((p) => p.name)).toEqual(["Bulbasaur", "Ivysaur", "Venusaur"]);
  });

  it("does not mutate input", () => {
    const before = samples.map((p) => p.id);
    sortPokemon(samples, "id");
    expect(samples.map((p) => p.id)).toEqual(before);
  });
});
