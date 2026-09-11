import { NextResponse } from "next/server";
import { z } from "zod";
import { getEnv } from "@/config/env";
import { assertSameOriginMutation } from "@/security/request";
import { rateLimit } from "@/security/rate-limit";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions, verifyAccessCode } from "@/security/auth";
import { recordAudit } from "@/db/records";

const schema = z.object({ code: z.string().min(1).max(256) });

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    const rl = rateLimit(`login:${request.headers.get("x-forwarded-for") ?? "local"}`, 5, 15 * 60_000);
    if (!rl.allowed) return NextResponse.json({ ok: false, message: "Too many login attempts." }, { status: 429 });
    const env = getEnv();
    if (env.DEMO_MODE || env.AUTH_MODE === "demo") return NextResponse.json({ ok: true, demo: true });
    const { code } = schema.parse(await request.json());
    if (!env.APP_ACCESS_CODE_SHA256 || !env.APP_SESSION_SECRET || !verifyAccessCode(code, env.APP_ACCESS_CODE_SHA256)) {
      await recordAudit({ action: "auth.login_failed", entityType: "session", data: {} });
      return NextResponse.json({ ok: false, message: "Invalid access code." }, { status: 401 });
    }
    const token = createSessionToken(env.APP_SESSION_SECRET, env.APP_SESSION_TTL_HOURS);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(env.APP_SESSION_TTL_HOURS * 3600));
    await recordAudit({ action: "auth.login_succeeded", entityType: "session", data: {} });
    return response;
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Login failed" }, { status: 400 });
  }
}
