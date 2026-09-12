import "server-only";
import type { BrokerOrder } from "../domain/types";
import type { ExecutionIdempotencyStore, ExecutionIntent } from "../execution/ExecutionEngine";
import { getEnv } from "../config/env";
import { db } from "./client";
import { toDbJson } from "./json";
import { logEvent } from "../logging/logger";

export class PostgresExecutionStore implements ExecutionIdempotencyStore {
  async claim(intent: ExecutionIntent) {
    const env = getEnv();
    if (!env.DATABASE_URL) return { claimed: true };
    const sql = db();
    const rows = await sql<{ id: string }[]>`
      insert into orders (
        client_order_id, idempotency_key, mode, symbol, side, quantity, order_type,
        stop_loss, take_profit, status, request_payload
      ) values (
        ${intent.clientOrderId}, ${intent.idempotencyKey}, ${intent.mode}, ${intent.symbol}, 'BUY',
        ${intent.quantity}, 'MARKET', ${intent.stopLoss}, ${intent.takeProfit}, 'NEW',
        ${sql.json(toDbJson({ proposalId: intent.proposalId }))}
      )
      on conflict do nothing
      returning id
    `;
    if (rows[0]) return { claimed: true, recordId: rows[0].id };
    const existing = await sql<{ id: string }[]>`
      select id from orders where mode = ${intent.mode} and idempotency_key = ${intent.idempotencyKey} limit 1
    `;
    logEvent("warn", "order.duplicate_blocked", { symbol: intent.symbol, mode: intent.mode, recordId: existing[0]?.id });
    return { claimed: false, recordId: existing[0]?.id };
  }

  async complete(recordId: string | undefined, order: BrokerOrder) {
    if (!recordId || !getEnv().DATABASE_URL) return;
    try {
      const sql = db();
      await sql`
        update orders set broker_order_id = ${order.id}, status = ${order.status}, response_payload = ${sql.json(toDbJson(order))}, updated_at = now()
        where id = ${recordId}
      `;
    } catch (error) {
      // The broker has already accepted/filled the order. Never convert a successful submit into a false client failure.
      logEvent("error", "order.persistence_complete_failed", { recordId, brokerOrderId: order.id, error: error instanceof Error ? error.message : "unknown" });
    }
  }

  async fail(recordId: string | undefined, code: string) {
    if (!recordId || !getEnv().DATABASE_URL) return;
    try {
      const sql = db();
      // Keep the intent non-retriable until explicit reconciliation; do not assume the broker never received it.
      await sql`
        update orders set response_payload = ${sql.json(toDbJson({ reconciliationRequired: true, errorCode: code.slice(0, 120) }))}, updated_at = now()
        where id = ${recordId}
      `;
    } catch (error) {
      logEvent("error", "order.persistence_fail_marker_failed", { recordId, error: error instanceof Error ? error.message : "unknown" });
    }
  }
}
