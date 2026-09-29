interface ClientIdCrypto {
  getRandomValues?: (array: Uint8Array) => Uint8Array;
  randomUUID?: () => string;
}

let fallbackCounter = 0;

export function createClientId(
  cryptoSource: ClientIdCrypto | null | undefined = globalThis.crypto
): string {
  if (typeof cryptoSource?.randomUUID === "function") {
    try {
      return cryptoSource.randomUUID();
    } catch {
      // Continue with a compatible fallback.
    }
  }

  const bytes = new Uint8Array(16);
  if (typeof cryptoSource?.getRandomValues === "function") {
    try {
      cryptoSource.getRandomValues(bytes);
      return formatUuidV4(bytes);
    } catch {
      // Continue with the last-resort fallback.
    }
  }

  fillFallbackBytes(bytes);
  return formatUuidV4(bytes);
}

function fillFallbackBytes(bytes: Uint8Array): void {
  const timestamp = Date.now();
  fallbackCounter = (fallbackCounter + 1) >>> 0;

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }
  for (let index = 0; index < 6; index += 1) {
    bytes[index] = Math.floor(timestamp / 2 ** (index * 8)) & 0xff;
  }
  for (let index = 0; index < 4; index += 1) {
    bytes[12 + index] = (fallbackCounter >>> (index * 8)) & 0xff;
  }
}

function formatUuidV4(bytes: Uint8Array): string {
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join("")
  ].join("-");
}
