import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseEnv } from "./env";

afterEach(() => vi.unstubAllEnvs());

describe("getSupabaseEnv", () => {
  it("restituisce null se la configurazione manca", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    expect(getSupabaseEnv()).toBeNull();
  });

  it("restituisce null se l'URL non è valido", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "non-un-url");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "chiave");
    expect(getSupabaseEnv()).toBeNull();
  });

  it("restituisce la configurazione se è valida", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "chiave");
    expect(getSupabaseEnv()).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "chiave",
    });
  });
});
