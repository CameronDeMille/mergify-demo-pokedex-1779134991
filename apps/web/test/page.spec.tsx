import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import Page from "../app/page";

describe("Page", () => {
  it("renders the pokedex heading and at least one entry", () => {
    const { getByRole, container } = render(<Page />);
    expect(getByRole("heading", { level: 1 }).textContent).toBe("Pokedex");
    expect(container.querySelectorAll("li").length).toBeGreaterThan(0);
  });
});
