import "server-only";
import { createHash } from "node:crypto";
import { db } from "./client";
import { toDbJson } from "./json";

export async function writeAuditLog(input: { userId?: string; eventType: string; actorType: string; actorId?: string; entityType?: string; entityId?: string; payload?: Record<string, unknown>; ip?: string }) {
  const sql = db();
  const ipHash = input.ip ? createHash("sha256").update(input.ip).digest("hex") : null;
  await sql`INSERT INTO audit_logs (user_id, event_type, actor_type, actor_id, entity_type, entity_id, payload, ip_hash)
    VALUES (${input.userId ?? null}, ${input.eventType}, ${input.actorType}, ${input.actorId ?? null}, ${input.entityType ?? null}, ${input.entityId ?? null}, ${sql.json(toDbJson(input.payload ?? {}))}, ${ipHash})`;
}
