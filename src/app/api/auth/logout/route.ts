import { NextResponse } from "next/server";
import { assertAuthorizedRequest, SESSION_COOKIE, sessionCookieOptions } from "@/security/auth";
import { assertSameOriginMutation } from "@/security/request";

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    assertAuthorizedRequest(request);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
    return response;
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Logout failed" }, { status: 401 });
  }
}
