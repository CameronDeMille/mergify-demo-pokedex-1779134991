import { describe, it, expect, beforeEach } from "vitest";
import { app } from "../src/app.js";
import { _resetFavoritesForTests } from "../src/routes/favorites.js";

beforeEach(() => {
  _resetFavoritesForTests();
});

describe("favorites", () => {
  it("rejects POST /favorites without a token", async () => {
    const res = await app.request("/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pokemonId: 1 }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects an invalid token", async () => {
    const res = await app.request("/favorites", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer nope",
      },
      body: JSON.stringify({ pokemonId: 1 }),
    });
    expect(res.status).toBe(401);
  });

  it("creates a favorite for the authenticated user", async () => {
    const res = await app.request("/favorites", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer demo-token-alice",
      },
      body: JSON.stringify({ pokemonId: 25 }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.userId).toBe("alice");
    expect(body.pokemonId).toBe(25);
    expect(typeof body.createdAt).toBe("string");
  });

  it("lists favorites for a user", async () => {
    await app.request("/favorites", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer demo-token-alice",
      },
      body: JSON.stringify({ pokemonId: 25 }),
    });
    const res = await app.request("/favorites/alice");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.length).toBe(1);
    expect(body.items[0].pokemonId).toBe(25);
  });

  it("isolates favorites per user", async () => {
    await app.request("/favorites", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer demo-token-alice",
      },
      body: JSON.stringify({ pokemonId: 1 }),
    });
    const res = await app.request("/favorites/bob");
    const body = await res.json();
    expect(body.items.length).toBe(0);
  });
});
