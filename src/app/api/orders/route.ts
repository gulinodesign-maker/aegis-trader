import { NextResponse } from "next/server";
import { z } from "zod";
import { getEnv } from "@/config/env";
import { getRuntime } from "@/runtime/factory";
import { assertSameOriginMutation } from "@/security/request";
import { assertAuthorizedRequest } from "@/security/auth";
import { rateLimit } from "@/security/rate-limit";
import { logEvent } from "@/logging/logger";
import { ExecutionEngine } from "@/execution/ExecutionEngine";
import { buildExecutionContext } from "@/execution/context";
import { PostgresExecutionStore } from "@/db/execution-store";
import { recordFilledTrade } from "@/db/trades";
import { recordAudit, recordRiskEvent } from "@/db/records";
import { getEffectiveRiskConfig } from "@/risk/kill-switch";
import { getTradeProposal } from "@/proposals/store";

const bodySchema = z.object({ proposalId: z.string().min(1).max(200) });

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    assertAuthorizedRequest(request);
    const rl = rateLimit(`orders:${request.headers.get("x-forwarded-for") ?? "local"}`, 10, 60_000);
    if (!rl.allowed) return NextResponse.json({ ok: false, message: "Rate limit exceeded." }, { status: 429 });
    const env = getEnv();
    const input = bodySchema.parse(await request.json());
    if (env.EXECUTION_MODE !== "MANUAL") return NextResponse.json({ ok: false, message: "This endpoint requires explicit MANUAL confirmation in V1." }, { status: 409 });

    const proposal = await getTradeProposal(input.proposalId);
    if (!proposal) return NextResponse.json({ ok: false, message: "Stored AI proposal not found. Analyze the opportunity again." }, { status: 404 });
    if (proposal.action !== "BUY") return NextResponse.json({ ok: false, message: `Agent proposal is ${proposal.action}, not BUY.` }, { status: 422 });

    const { context, signal, fxRateToAccountCurrency, observedAverageDollarVolume } = await buildExecutionContext(proposal);
    const { broker } = getRuntime();
    const engine = new ExecutionEngine(broker, getEffectiveRiskConfig, new PostgresExecutionStore());
    const result = await engine.executeBuy(proposal, context, { observedAtrPercent: signal?.metrics.atrPercent, observedAverageDollarVolume });

    const proposalRecordId = env.DATABASE_URL ? await findProposalDatabaseId(proposal.id) : undefined;
    await recordRiskEvent({ proposalId: proposalRecordId, approved: result.risk.approved, reasons: result.risk.reasons, checks: { symbol: proposal.symbol, quantity: result.risk.quantity, exposureAfter: result.risk.exposureAfter, maxLoss: result.risk.maxLoss, quoteTimestamp: context.quote.timestamp } });
    logEvent(result.risk.approved ? "info" : "warn", "risk.decision", { symbol: proposal.symbol, approved: result.risk.approved, reasons: result.risk.reasons, quantity: result.risk.quantity });

    if (!result.executed || !result.order) {
      return NextResponse.json({ ok: false, message: `Risk Engine rejected: ${result.risk.reasons.join(", ")}`, risk: result.risk }, { status: 422 });
    }

    await recordFilledTrade({ orderRecordId: result.persistenceId, mode: context.account.mode, order: result.order, proposal, quote: context.quote, signal, risk: result.risk, fxRateToAccountCurrency });
    await recordAudit({ action: "order.submitted", entityType: "order", entityId: result.order.id, data: { symbol: result.order.symbol, mode: context.account.mode, quantity: result.order.quantity, proposalId: proposal.id } });
    logEvent("info", "order.submitted", { orderId: result.order.id, symbol: result.order.symbol, mode: context.account.mode, quantity: result.order.quantity });
    return NextResponse.json({ ok: true, message: `${context.account.mode.toUpperCase()} order filled/sent after Agent proposal + Risk Engine approval.`, order: result.order, risk: result.risk });
  } catch (error) {
    logEvent("error", "order.error", { error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Order failed" }, { status: 400 });
  }
}

async function findProposalDatabaseId(externalId: string) {
  const { db } = await import("@/db/client");
  const sql = db();
  const rows = await sql<{ id: string }[]>`select id from trade_proposals where external_id = ${externalId} limit 1`;
  return rows[0]?.id;
}
