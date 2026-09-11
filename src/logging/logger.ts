import "server-only";

const REDACT_KEYS = /(?:password|secret|token|api[_-]?key|authorization|bank|iban|refresh[_-]?token|private[_-]?key)/i;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, REDACT_KEYS.test(key) ? "[REDACTED]" : redact(nested)]));
  }
  return value;
}

export function logEvent(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ level, event, timestamp: new Date().toISOString(), ...redact(fields) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
