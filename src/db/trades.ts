import "server-only";
import { getEnv } from "../config/env";
import { db } from "./client";
import type { BrokerOrder, Quote, RiskDecision, Signal, TradeProposal } from "../domain/types";
import { logEvent } from "../logging/logger";

export async function recordFilledTrade(input: {
  orderRecordId?: string;
  mode: "paper" | "live";
  order: BrokerOrder;
  proposal: TradeProposal;
  quote: Quote;
  signal?: Signal;
  risk: RiskDecision;
  fxRateToAccountCurrency: number;
}) {
  if (!getEnv().DATABASE_URL || !input.orderRecordId || input.order.status !== "FILLED" || input.order.averageFillPrice == null) return;
  try {
    const sql = db();
    const slippage = Math.abs(input.order.averageFillPrice - input.proposal.entry) * input.order.quantity * input.fxRateToAccountCurrency;
    const rows = await sql<{ id: string }[]>`
      insert into trades (
        order_id, mode, symbol, quantity, entry, fees, slippage, market_data, signals_snapshot,
        agent_reasoning_summary, risk_checks, opened_at
      ) values (
        ${input.orderRecordId}, ${input.mode}, ${input.order.symbol}, ${input.order.quantity}, ${input.order.averageFillPrice},
        0, ${slippage}, ${sql.json(input.quote)}, ${sql.json(input.signal ? [input.signal] : [])},
        ${input.proposal.thesis}, ${sql.json(input.risk)}, ${input.order.updatedAt}
      ) returning id
    `;
    const updated = await sql<{ id: string }[]>`
      update positions set quantity = ${input.order.quantity}, average_entry = ${input.order.averageFillPrice},
        stop_loss = ${input.proposal.stopLoss}, take_profit = ${input.proposal.takeProfit},
        current_price = ${input.order.averageFillPrice}, unrealized_pnl = 0, updated_at = now()
      where user_id is null and mode = ${input.mode} and symbol = ${input.order.symbol}
      returning id
    `;
    if (!updated.length) {
      await sql`
        insert into positions (mode, symbol, quantity, average_entry, stop_loss, take_profit, current_price, unrealized_pnl)
        values (${input.mode}, ${input.order.symbol}, ${input.order.quantity}, ${input.order.averageFillPrice}, ${input.proposal.stopLoss}, ${input.proposal.takeProfit}, ${input.order.averageFillPrice}, 0)
        on conflict do nothing
      `;
    }
    return rows[0]?.id;
  } catch (error) {
    // Post-trade bookkeeping must never make a broker-confirmed fill look like a failed submission.
    logEvent("error", "trade.persistence_failed", { brokerOrderId: input.order.id, symbol: input.order.symbol, error: error instanceof Error ? error.message : "unknown" });
    return undefined;
  }
}
