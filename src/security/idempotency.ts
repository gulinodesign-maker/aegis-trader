import { createHash, randomUUID } from "node:crypto";

export function createOrderIdempotencyKey(input: { accountId: string; proposalId: string; symbol: string; side: string }) {
  const stable = `${input.accountId}|${input.proposalId}|${input.symbol}|${input.side}`;
  return createHash("sha256").update(stable).digest("hex");
}

export class InMemoryIdempotencyStore {
  private readonly seen = new Map<string, number>();
  constructor(private readonly ttlMs = 86_400_000) {}

  claim(key: string, now = Date.now()) {
    this.prune(now);
    if (this.seen.has(key)) return false;
    this.seen.set(key, now + this.ttlMs);
    return true;
  }

  release(key: string) { this.seen.delete(key); }

  private prune(now: number) {
    for (const [key, expiresAt] of this.seen.entries()) if (expiresAt <= now) this.seen.delete(key);
  }
}

export function createClientOrderId(prefix = "aegis") {
  return `${prefix}-${randomUUID()}`;
}
