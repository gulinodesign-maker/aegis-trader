export interface LiveGateInput {
  tradingMode?: string;
  enableLiveTrading?: string;
  liveTradingAcknowledged?: string;
  brokerProvider?: string;
  brokerApiKey?: string;
  brokerApiSecret?: string;
}

export function validateLiveTradingGate(input: LiveGateInput) {
  const mode = input.tradingMode ?? "paper";
  if (mode !== "live") return { allowed: true, mode: "paper" as const, reasons: [] as string[] };
  const reasons: string[] = [];
  if (input.enableLiveTrading !== "true") reasons.push("ENABLE_LIVE_TRADING_MUST_BE_TRUE");
  if (input.liveTradingAcknowledged !== "true") reasons.push("LIVE_TRADING_ACKNOWLEDGED_MUST_BE_TRUE");
  if (!input.brokerProvider || input.brokerProvider === "paper") reasons.push("REAL_BROKER_REQUIRED");
  if (!input.brokerApiKey) reasons.push("BROKER_API_KEY_REQUIRED");
  if (!input.brokerApiSecret) reasons.push("BROKER_API_SECRET_REQUIRED");
  return { allowed: reasons.length === 0, mode: "live" as const, reasons };
}
