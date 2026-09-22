import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

// A single site-owner session, entirely separate from alliance login (Chief
// ID + shared password) and from any alliance's admin flag. No DB row, no
// alliance membership — just a signed cookie checked against env secrets.
const COOKIE_NAME = "owner_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function sign(payload: string) {
  const secret = process.env.OWNER_SESSION_SECRET;
  if (!secret) throw new Error("OWNER_SESSION_SECRET is not configured.");
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export async function createOwnerSession() {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = String(expires);
  const token = `${payload}.${sign(payload)}`;

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearOwnerSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function hasOwnerSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;

  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;

  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return false;
  }

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  return Number(payload) > Date.now();
}

export function checkOwnerPassword(password: string): boolean {
  const expected = process.env.OWNER_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
