import { Hono } from "hono";
import { listRoute } from "./routes/list.js";

export const app = new Hono();

app.route("/", listRoute);
app.get("/health", (c) => c.json({ ok: true }));
