import "server-only";
import { createHash } from "node:crypto";
import { getEnv } from "../config/env";
import { db } from "./client";
import { toDbJson } from "./json";
import type { TradeProposal } from "../domain/types";
import { logEvent } from "../logging/logger";

export function hashPrompt(prompt: string) {
  return createHash("sha256").update(prompt).digest("hex");
}

export async function startAgentRun(input: { mode: "paper" | "live"; model: string; prompt: string }) {
  if (!getEnv().DATABASE_URL) return undefined;
  const sql = db();
  const rows = await sql<{ id: string }[]>`
    insert into agent_runs (mode, model, prompt_hash, status)
    values (${input.mode}, ${input.model}, ${hashPrompt(input.prompt)}, 'RUNNING')
    returning id
  `;
  return rows[0]?.id;
}

export async function appendAgentRunEvent(runId: string | undefined, event: { type: string; payload: unknown }) {
  if (!runId || !getEnv().DATABASE_URL) return;
  try {
    const sql = db();
    await sql`
      update agent_runs
      set tool_trace = tool_trace || ${sql.json(toDbJson([{ type: event.type, payload: event.payload, at: new Date().toISOString() }]))}::jsonb
      where id = ${runId}
    `;
  } catch (error) {
    logEvent("error", "agent.trace_persist_failed", { runId, error: error instanceof Error ? error.message : "unknown" });
  }
}

export async function finishAgentRun(runId: string | undefined, status: "COMPLETED" | "FAILED", errorCode?: string) {
  if (!runId || !getEnv().DATABASE_URL) return;
  try {
    const sql = db();
    await sql`
      update agent_runs set status = ${status}, finished_at = now(), error_code = ${errorCode?.slice(0, 120) ?? null}
      where id = ${runId}
    `;
  } catch (error) {
    logEvent("error", "agent.finish_persist_failed", { runId, status, error: error instanceof Error ? error.message : "unknown" });
  }
}

export async function recordTradeProposal(proposal: TradeProposal, agentRunId?: string) {
  if (!getEnv().DATABASE_URL) return undefined;
  const sql = db();
  const rows = await sql<{ id: string }[]>`
    insert into trade_proposals (
      external_id, agent_run_id, symbol, action, confidence, entry, stop_loss, take_profit,
      risk_reward, position_size, thesis, invalidation, signal_ids
    ) values (
      ${proposal.id}, ${agentRunId ?? null}, ${proposal.symbol}, ${proposal.action}, ${proposal.confidence},
      ${proposal.entry}, ${proposal.stopLoss}, ${proposal.takeProfit}, ${proposal.riskReward}, ${proposal.positionSize},
      ${proposal.thesis}, ${proposal.invalidation}, ${sql.json(toDbJson(proposal.signalIds))}
    )
    on conflict (external_id) do update set external_id = excluded.external_id
    returning id
  `;
  return rows[0]?.id;
}
