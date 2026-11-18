import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual
} from "node:crypto";

const PASSWORD_KEY_LENGTH = 64;

export function hashPassword(password: string): {
  hash: string;
  salt: string;
} {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString("hex");
  return { hash, salt };
}

export function verifyPassword(
  password: string,
  expectedHash: string,
  salt: string
): boolean {
  const actual = scryptSync(password, salt, PASSWORD_KEY_LENGTH);
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
