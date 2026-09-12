import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getEnv } from "../config/env";

export const SESSION_COOKIE = "aegis_session";

interface SessionPayload {
  v: 1;
  sub: "single-user";
  exp: number;
}

function encode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function sign(payloadEncoded: string, secret: string) {
  return createHmac("sha256", secret).update(payloadEncoded).digest("base64url");
}

export function hashAccessCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export function verifyAccessCode(code: string, expectedSha256: string) {
  if (!/^[a-f0-9]{64}$/i.test(expectedSha256)) return false;
  const actual = Buffer.from(hashAccessCode(code), "hex");
  const expected = Buffer.from(expectedSha256, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createSessionToken(secret: string, ttlHours: number, now = Date.now()) {
  const payload: SessionPayload = { v: 1, sub: "single-user", exp: Math.floor(now / 1000) + ttlHours * 3600 };
  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifySessionToken(token: string | undefined, secret: string, now = Date.now()) {
  if (!token) return false;
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) return false;
  const expected = sign(encoded, secret);
  const a = Buffer.from(signature, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    return payload.v === 1 && payload.sub === "single-user" && Number.isFinite(payload.exp) && payload.exp > Math.floor(now / 1000);
  } catch {
    return false;
  }
}

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: maxAgeSeconds
  };
}

export function requestCookie(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function assertAuthorizedRequest(request: Request) {
  const env = getEnv();
  if (env.DEMO_MODE || env.AUTH_MODE === "demo") return;
  const token = requestCookie(request, SESSION_COOKIE);
  if (!env.APP_SESSION_SECRET || !verifySessionToken(token, env.APP_SESSION_SECRET)) throw new Error("UNAUTHORIZED");
}

export async function requirePageAuthorization() {
  const env = getEnv();
  if (env.DEMO_MODE || env.AUTH_MODE === "demo") return;
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!env.APP_SESSION_SECRET || !verifySessionToken(token, env.APP_SESSION_SECRET)) redirect("/login");
}
