import { describe, expect, it } from "vitest";
import { normalizePathname } from "./url-normalization";

describe("normalizePathname", () => {
  it("converte barras duplicadas na raiz para a rota inicial", () => {
    expect(normalizePathname("//")).toBe("/");
    expect(normalizePathname("///")).toBe("/");
  });

  it("preserva caminhos válidos e normaliza separadores repetidos", () => {
    expect(normalizePathname("/")).toBe("/");
    expect(normalizePathname("/loja")).toBe("/loja");
    expect(normalizePathname("/categoria//1")).toBe("/categoria/1");
  });
});
