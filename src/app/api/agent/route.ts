import { NextResponse } from "next/server";
import { z } from "zod";
import { getEnv, riskConfigFromEnv } from "@/config/env";
import { demoSignals } from "@/demo/data";
import { getRuntime } from "@/runtime/factory";
import { rateLimit } from "@/security/rate-limit";
import { assertSameOriginMutation } from "@/security/request";
import { assertAuthorizedRequest } from "@/security/auth";
import { runTradingAgent } from "@/agent/trading-agent";
import { recordAudit } from "@/db/records";
import { appendAgentRunEvent, finishAgentRun, startAgentRun } from "@/db/agent";
import { saveTradeProposal } from "@/proposals/store";
import { buildDemoProposal } from "@/demo/agent";

const inputSchema = z.object({ message: z.string().trim().min(1).max(1000) });

function demoReply(message: string) {
  const lower = message.toLowerCase();
  const requested = demoSignals.find(signal => lower.includes(signal.symbol.toLowerCase()));
  const signal = requested ?? demoSignals[0];
  const asksClose = lower.includes("chius") || lower.includes("closed");
  const proposal = buildDemoProposal(signal, asksClose ? "WAIT" : "BUY");

  let answer: string;
  if (lower.includes("risch")) answer = "Con equity demo di €20 e rischio massimo 0,5%, il budget iniziale è €0,10 per trade. La quantità effettiva viene calcolata dal Risk Engine usando distanza entry-stop, riserva cash, esposizione e supporto fractional.";
  else if (lower.includes("migliore")) answer = `Nel dataset DEMO la shortlist è ${demoSignals.map(s => `${s.symbol} ${s.score}`).join(", ")}. Il segnale più alto è ${demoSignals[0].symbol}; è comunque solo una proposta e non un ordine.`;
  else if (lower.includes("mercato") || lower.includes("succed")) answer = "Nel dataset DEMO i tre titoli sintetici mostrano momentum positivo, ma spread, volatilità, freschezza quote e market clock restano filtri obbligatori prima di qualunque ordine.";
  else answer = `${signal.symbol}: score ${signal.score}/100, entry $${signal.entry.toFixed(2)}, stop $${signal.stop.toFixed(2)}, target $${signal.target.toFixed(2)}, R:R ${signal.riskReward.toFixed(2)}×. ${signal.reasons.join("; ")}.`;
  return { proposal, answer, dataOrigin: "DEMO", note: "Risposta demo deterministica; nessuna quotazione reale è stata usata." };
}

export async function POST(request: Request) {
  let runId: string | undefined;
  try {
    assertSameOriginMutation(request);
    assertAuthorizedRequest(request);
    const limit = rateLimit(`agent:${request.headers.get("x-forwarded-for") ?? "local"}`, 20, 60_000);
    if (!limit.allowed) return NextResponse.json({ ok: false, message: "Rate limit exceeded." }, { status: 429 });
    const { message } = inputSchema.parse(await request.json());
    const env = getEnv();
    runId = await startAgentRun({ mode: env.TRADING_MODE, model: env.DEMO_MODE ? "demo-deterministic" : env.OPENAI_MODEL, prompt: message });

    if (env.DEMO_MODE) {
      const result = demoReply(message);
      await saveTradeProposal(result.proposal, runId);
      await appendAgentRunEvent(runId, { type: "proposal", payload: { symbol: result.proposal.symbol, action: result.proposal.action, confidence: result.proposal.confidence } });
      await finishAgentRun(runId, "COMPLETED");
      await recordAudit({ action: "agent.demo_response", entityType: "agent_run", entityId: runId, data: { messageLength: message.length, symbol: result.proposal.symbol, action: result.proposal.action } });
      return NextResponse.json({ ok: true, ...result });
    }

    if (!env.OPENAI_API_KEY) {
      await finishAgentRun(runId, "FAILED", "OPENAI_API_KEY_REQUIRED");
      return NextResponse.json({ ok: false, message: "OPENAI_API_KEY is required outside DEMO_MODE." }, { status: 503 });
    }

    const runtime = getRuntime();
    const risk = riskConfigFromEnv();
    const proposal = await runTradingAgent({
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL,
      userPrompt: message,
      context: {
        marketData: runtime.marketData,
        broker: runtime.broker,
        universe: ["AAPL", "MSFT", "NVDA"],
        risk: {
          maxRiskPerTradePercent: risk.maxRiskPerTradePercent,
          minCashReservePercent: risk.minCashReservePercent,
          maxSinglePositionPercent: risk.maxSinglePositionPercent
        },
        fxRateToAccountCurrency: runtime.fxRateToAccountCurrency
      },
      onEvent: async event => {
        await appendAgentRunEvent(runId, event);
        await recordAudit({ action: `agent.${event.type}`, entityType: "agent_run", entityId: runId, data: { payload: event.payload } });
      }
    });
    await saveTradeProposal(proposal, runId);
    await finishAgentRun(runId, "COMPLETED");
    const answer = `${proposal.action} ${proposal.symbol}. Confidence ${proposal.confidence.toFixed(0)}/100. ${proposal.thesis} Invalidation: ${proposal.invalidation}. Any BUY still requires deterministic Risk Engine approval.`;
    return NextResponse.json({ ok: true, proposal, answer, dataOrigin: "PROVIDER" });
  } catch (error) {
    await finishAgentRun(runId, "FAILED", error instanceof Error ? error.message : "AGENT_ERROR").catch(() => undefined);
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Agent request failed" }, { status: 400 });
  }
}
