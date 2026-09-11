import "server-only";
import { getEnv, riskConfigFromEnv } from "../config/env";
import { db } from "../db/client";
import { logEvent } from "../logging/logger";
import type { RiskConfig } from "../domain/types";

let memoryOverride: boolean | undefined;

export async function isKillSwitchActive(): Promise<boolean> {
  const env = getEnv();
  if (env.KILL_SWITCH) return true;
  if (memoryOverride !== undefined) return memoryOverride;
  if (!env.DATABASE_URL) return false;

  try {
    const sql = db();
    const rows = await sql<{ bool_value: boolean }[]>`
      select bool_value from system_controls where key = 'global_kill_switch' limit 1
    `;
    return rows[0]?.bool_value ?? false;
  } catch (error) {
    // Fail closed when a production persistence layer exists but cannot be checked.
    logEvent("error", "kill_switch.read_failed", { error: error instanceof Error ? error.message : "unknown" });
    return !env.DEMO_MODE;
  }
}

export async function setKillSwitch(active: boolean): Promise<boolean> {
  const env = getEnv();
  if (!active && env.KILL_SWITCH) throw new Error("ENV_KILL_SWITCH_LOCKED");

  // Turning ON is immediate for this process before any network/database work.
  if (active) memoryOverride = true;

  if (env.DATABASE_URL) {
    try {
      const sql = db();
      await sql`
        insert into system_controls (key, bool_value, updated_at)
        values ('global_kill_switch', ${active}, now())
        on conflict (key) do update set bool_value = excluded.bool_value, updated_at = now()
      `;
    } catch (error) {
      logEvent("error", "kill_switch.persist_failed", { active, error: error instanceof Error ? error.message : "unknown" });
      // Never silently re-enable trading when the shared control cannot be persisted.
      if (!active) memoryOverride = true;
      throw new Error("KILL_SWITCH_PERSISTENCE_FAILED");
    }
  }

  memoryOverride = active;
  logEvent(active ? "warn" : "info", "kill_switch.changed", { active });
  return active;
}

export async function getEffectiveRiskConfig(): Promise<RiskConfig> {
  const config = riskConfigFromEnv();
  return { ...config, killSwitch: config.killSwitch || await isKillSwitchActive() };
}
