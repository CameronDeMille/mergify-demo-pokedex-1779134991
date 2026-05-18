import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { Pokemon } from "@pokedex/types";

const here = dirname(fileURLToPath(import.meta.url));
const dataPath = resolve(here, "../../../../data/pokemon.json");

export const pokemon: Pokemon[] = JSON.parse(readFileSync(dataPath, "utf8"));
