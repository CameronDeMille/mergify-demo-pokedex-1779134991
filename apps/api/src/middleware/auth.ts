import type { MiddlewareHandler } from "hono";

export const VALID_TOKENS: ReadonlySet<string> = new Set([
  "demo-token-alice",
  "demo-token-bob",
]);

export const TOKEN_TO_USER: Record<string, string> = {
  "demo-token-alice": "alice",
  "demo-token-bob": "bob",
};

export const bearerAuth: MiddlewareHandler<{
  Variables: { userId: string };
}> = async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return c.json({ error: "missing bearer token" }, 401);
  }
  const token = header.slice("Bearer ".length).trim();
  if (!VALID_TOKENS.has(token)) {
    return c.json({ error: "invalid token" }, 401);
  }
  c.set("userId", TOKEN_TO_USER[token]);
  await next();
};
