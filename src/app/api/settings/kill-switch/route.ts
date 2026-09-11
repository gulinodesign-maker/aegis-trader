import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOriginMutation } from "@/security/request";
import { rateLimit } from "@/security/rate-limit";
import { isKillSwitchActive, setKillSwitch } from "@/risk/kill-switch";
import { recordAudit } from "@/db/records";
import { assertAuthorizedRequest } from "@/security/auth";

const bodySchema = z.object({ active: z.boolean() });

export async function GET(request: Request) {
  assertAuthorizedRequest(request);
  return NextResponse.json({ ok: true, active: await isKillSwitchActive() });
}

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    assertAuthorizedRequest(request);
    const limit = rateLimit(`kill-switch:${request.headers.get("x-forwarded-for") ?? "local"}`, 20, 60_000);
    if (!limit.allowed) return NextResponse.json({ ok: false, message: "Rate limit exceeded." }, { status: 429 });
    const { active } = bodySchema.parse(await request.json());
    const effective = await setKillSwitch(active);
    await recordAudit({ action: "kill_switch.changed", entityType: "system_control", entityId: "global_kill_switch", data: { active: effective } });
    return NextResponse.json({ ok: true, active: effective });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Kill switch update failed" }, { status: 400 });
  }
}
