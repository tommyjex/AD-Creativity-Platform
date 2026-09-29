import { describe, expect, it, vi } from "vitest";
import { createClientId } from "@/lib/client-id";

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("createClientId", () => {
  it("prefers crypto.randomUUID when available", () => {
    const randomUUID = vi.fn(
      () => "00000000-0000-4000-8000-000000000001"
    );

    expect(createClientId({ randomUUID })).toBe(
      "00000000-0000-4000-8000-000000000001"
    );
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it("creates an RFC 4122 version 4 UUID with getRandomValues", () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.set(Array.from({ length: 16 }, (_, index) => index));
      return bytes;
    });

    const id = createClientId({ getRandomValues });

    expect(id).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f");
    expect(id).toMatch(UUID_V4_PATTERN);
    expect(getRandomValues).toHaveBeenCalledOnce();
  });

  it("falls back when crypto.randomUUID throws", () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.fill(1);
      return bytes;
    });

    expect(
      createClientId({
        getRandomValues,
        randomUUID: () => {
          throw new Error("unavailable");
        }
      })
    ).toBe("01010101-0101-4101-8101-010101010101");
  });

  it("still returns distinct UUID-shaped IDs without Web Crypto", () => {
    const first = createClientId(null);
    const second = createClientId(null);

    expect(first).toMatch(UUID_V4_PATTERN);
    expect(second).toMatch(UUID_V4_PATTERN);
    expect(second).not.toBe(first);
  });
});
