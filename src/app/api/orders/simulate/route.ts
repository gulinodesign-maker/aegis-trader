import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOriginMutation } from "@/security/request";
import { assertAuthorizedRequest } from "@/security/auth";
import { rateLimit } from "@/security/rate-limit";
import { getTradeProposal } from "@/proposals/store";
import { buildExecutionContext } from "@/execution/context";
import { evaluateTradeRisk } from "@/risk/risk-engine";
import { getEffectiveRiskConfig } from "@/risk/kill-switch";
import { getRuntime } from "@/runtime/factory";

const schema = z.object({ proposalId: z.string().min(1).max(200) });

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    assertAuthorizedRequest(request);
    const limit = rateLimit(`simulate:${request.headers.get("x-forwarded-for") ?? "local"}`, 30, 60_000);
    if (!limit.allowed) return NextResponse.json({ ok: false, message: "Rate limit exceeded." }, { status: 429 });
    const { proposalId } = schema.parse(await request.json());
    const proposal = await getTradeProposal(proposalId);
    if (!proposal) return NextResponse.json({ ok: false, message: "Stored agent proposal not found." }, { status: 404 });
    const { context, signal, observedAverageDollarVolume } = await buildExecutionContext(proposal);
    const { broker } = getRuntime();
    const decision = evaluateTradeRisk(proposal, context, await getEffectiveRiskConfig(), {
      supportsFractional: broker.capabilities.fractionalShares,
      observedAtrPercent: signal?.metrics.atrPercent,
      observedAverageDollarVolume
    });
    return NextResponse.json({ ok: true, proposal, risk: decision, dataOrigin: context.quote.origin });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Simulation failed" }, { status: 400 });
  }
}
