import "server-only";
import { getEnv } from "../config/env";
import { db } from "./client";
import { logEvent } from "../logging/logger";

export async function recordAudit(input: {
  action: string;
  entityType: string;
  entityId?: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  const env = getEnv();
  if (!env.DATABASE_URL) return;
  try {
    const sql = db();
    await sql`
      insert into audit_logs (event_type, actor_type, entity_type, entity_id, payload)
      values (${input.action}, ${"system"}, ${input.entityType}, ${input.entityId ?? null}, ${sql.json(input.data ?? {})})
    `;
  } catch (error) {
    logEvent("error", "audit.persist_failed", { action: input.action, error: error instanceof Error ? error.message : "unknown" });
  }
}

export async function recordRiskEvent(input: {
  proposalId?: string;
  approved: boolean;
  reasons: string[];
  checks: Record<string, unknown>;
}): Promise<void> {
  const env = getEnv();
  if (!env.DATABASE_URL) return;
  try {
    const sql = db();
    await sql`
      insert into risk_events (proposal_id, approved, reasons, config_snapshot, context_snapshot, calculated_quantity, max_loss)
      values (
        ${input.proposalId ?? null}, ${input.approved}, ${sql.json(input.reasons)}, ${sql.json({})},
        ${sql.json(input.checks)}, ${Number(input.checks.quantity ?? 0)}, ${Number(input.checks.maxLoss ?? 0)}
      )
    `;
  } catch (error) {
    logEvent("error", "risk.persist_failed", { error: error instanceof Error ? error.message : "unknown" });
  }
}
