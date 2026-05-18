import { Hono } from "hono";
import { pokemon } from "./data/pokemon.js";

export const app = new Hono();

app.get("/pokemon", (c) => c.json(pokemon));
app.get("/health", (c) => c.json({ ok: true }));
