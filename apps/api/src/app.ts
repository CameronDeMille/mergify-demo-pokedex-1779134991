import { Hono } from "hono";
import { listRoute } from "./routes/list.js";
import { favoritesRoute } from "./routes/favorites.js";

export const app = new Hono();

app.route("/", listRoute);
app.route("/", favoritesRoute);
app.get("/health", (c) => c.json({ ok: true }));
