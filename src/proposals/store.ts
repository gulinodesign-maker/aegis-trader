import "server-only";
import type { TradeProposal } from "../domain/types";
import { getEnv } from "../config/env";
import { db } from "../db/client";
import { recordTradeProposal } from "../db/agent";
import { reconstructDemoProposal } from "../demo/agent";

const globalStore = globalThis as typeof globalThis & { __proposalStore?: Map<string, TradeProposal> };
function memory() { return (globalStore.__proposalStore ??= new Map<string, TradeProposal>()); }

export async function saveTradeProposal(proposal: TradeProposal, agentRunId?: string) {
  memory().set(proposal.id, proposal);
  const databaseId = await recordTradeProposal(proposal, agentRunId);
  return { proposal, databaseId };
}

export async function getTradeProposal(externalId: string): Promise<TradeProposal | null> {
  const cached = memory().get(externalId);
  if (cached) return cached;
  const env = getEnv();
  if (env.DEMO_MODE) {
    const reconstructed = reconstructDemoProposal(externalId);
    if (reconstructed) {
      memory().set(reconstructed.id, reconstructed);
      return reconstructed;
    }
  }
  if (!env.DATABASE_URL) return null;
  const sql = db();
  const rows = await sql<Array<{
    external_id: string; symbol: string; action: "BUY" | "WAIT" | "CLOSE"; confidence: string | number;
    entry: string | number; stop_loss: string | number; take_profit: string | number; risk_reward: string | number;
    position_size: string | number; thesis: string; invalidation: string; signal_ids: string[]; created_at: string | Date;
  }>>`
    select external_id, symbol, action, confidence, entry, stop_loss, take_profit, risk_reward,
           position_size, thesis, invalidation, signal_ids, created_at
    from trade_proposals where external_id = ${externalId} limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  const proposal: TradeProposal = {
    id: row.external_id,
    symbol: row.symbol,
    action: row.action,
    confidence: Number(row.confidence),
    entry: Number(row.entry),
    stopLoss: Number(row.stop_loss),
    takeProfit: Number(row.take_profit),
    riskReward: Number(row.risk_reward),
    positionSize: Number(row.position_size),
    thesis: row.thesis,
    invalidation: row.invalidation,
    signalIds: Array.isArray(row.signal_ids) ? row.signal_ids : [],
    createdAt: new Date(row.created_at).toISOString()
  };
  memory().set(proposal.id, proposal);
  return proposal;
}
