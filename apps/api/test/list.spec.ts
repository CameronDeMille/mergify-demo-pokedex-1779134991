import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { app } from "../src/app.js";

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(
  readFileSync(resolve(here, "../../../data/pokemon.json"), "utf8"),
) as Array<{ id: number }>;

describe("GET /pokemon pagination", () => {
  it("returns the full fixture total", async () => {
    const res = await app.request("/pokemon");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(data.length);
    expect(body.page).toBe(1);
  });

  it("respects pageSize", async () => {
    const res = await app.request("/pokemon?page=1&pageSize=5");
    const body = await res.json();
    expect(body.items.length).toBe(Math.min(5, data.length));
    expect(body.pageSize).toBe(5);
    expect(body.hasNext).toBe(data.length > 5);
  });

  it("returns the second page", async () => {
    const res = await app.request("/pokemon?page=2&pageSize=5");
    const body = await res.json();
    expect(body.page).toBe(2);
    const expectedLen = Math.max(0, Math.min(5, data.length - 5));
    expect(body.items.length).toBe(expectedLen);
  });

  it("returns sorted-by-id items", async () => {
    const res = await app.request("/pokemon?pageSize=100");
    const body = await res.json();
    const ids = body.items.map((p: { id: number }) => p.id);
    const sorted = [...ids].sort((a, b) => a - b);
    expect(ids).toEqual(sorted);
  });
});
