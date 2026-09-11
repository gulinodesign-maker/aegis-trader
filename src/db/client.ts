import "server-only";
import postgres from "postgres";
import { getEnv } from "../config/env";

let client: ReturnType<typeof postgres> | undefined;
export function db() {
  const env = getEnv();
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL_NOT_CONFIGURED");
  client ??= postgres(env.DATABASE_URL, { max: 5, idle_timeout: 20, connect_timeout: 10, prepare: false });
  return client;
}
