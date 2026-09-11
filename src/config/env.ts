import "server-only";
import { z } from "zod";
import { validateLiveTradingGate } from "./env-core";

const boolString = z.enum(["true", "false"]).default("false").transform(v => v === "true");
const numberString = (fallback: number) => z.string().default(String(fallback)).transform((value, ctx) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) { ctx.addIssue({ code: "custom", message: "Must be a finite number" }); return z.NEVER; }
  return parsed;
});

const envSchema = z.object({
  DEMO_MODE: z.enum(["true", "false"]).default("true").transform(v => v === "true"),
  AUTH_MODE: z.enum(["demo", "single-user"]).default("demo"),
  APP_ACCESS_CODE_SHA256: z.string().optional(),
  APP_SESSION_SECRET: z.string().optional(),
  APP_SESSION_TTL_HOURS: numberString(12).pipe(z.number().int().positive().max(168)),
  TRADING_MODE: z.enum(["paper", "live"]).default("paper"),
  EXECUTION_MODE: z.enum(["MANUAL", "ASSISTED", "AUTO"]).default("MANUAL"),
  INITIAL_CAPITAL_EUR: numberString(20).pipe(z.number().positive().max(1_000_000)),
  MAX_RISK_PER_TRADE_PERCENT: numberString(0.5).pipe(z.number().positive().max(5)),
  MAX_DAILY_LOSS_PERCENT: numberString(2).pipe(z.number().positive().max(20)),
  MAX_TOTAL_EXPOSURE_PERCENT: numberString(100).pipe(z.number().positive().max(100)),
  MAX_SINGLE_POSITION_PERCENT: numberString(35).pipe(z.number().positive().max(100)),
  MAX_OPEN_POSITIONS: numberString(3).pipe(z.number().int().positive().max(50)),
  MIN_CASH_RESERVE_PERCENT: numberString(10).pipe(z.number().min(0).max(99)),
  MAX_SPREAD_BPS: numberString(35).pipe(z.number().positive().max(500)),
  MAX_QUOTE_AGE_SECONDS: numberString(15).pipe(z.number().positive().max(300)),
  MAX_ATR_PERCENT: numberString(6).pipe(z.number().positive().max(50)),
  MIN_AVERAGE_DOLLAR_VOLUME: numberString(5_000_000).pipe(z.number().min(0)),
  LOSS_STREAK_COOLDOWN_COUNT: numberString(3).pipe(z.number().int().positive().max(20)),
  LOSS_STREAK_COOLDOWN_MINUTES: numberString(60).pipe(z.number().int().positive().max(10_080)),
  KILL_SWITCH: boolString,
  ENABLE_LIVE_TRADING: boolString,
  LIVE_TRADING_ACKNOWLEDGED: boolString,
  BROKER_PROVIDER: z.enum(["paper", "alpaca"]).default("paper"),
  ALPACA_API_KEY: z.string().optional(),
  ALPACA_API_SECRET: z.string().optional(),
  ALPACA_LIVE_BASE_URL: z.url().default("https://api.alpaca.markets"),
  ALPACA_PAPER_BASE_URL: z.url().default("https://paper-api.alpaca.markets"),
  ALPACA_DATA_BASE_URL: z.url().default("https://data.alpaca.markets"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5.6-luna"),
  DATABASE_URL: z.string().optional(),
  DATABASE_ENCRYPTION_KEY: z.string().optional(),
  FUNDING_PROVIDER: z.enum(["sepa", "revolut-business"]).default("sepa"),
  REVOLUT_BUSINESS_API_ENABLED: boolString,
  REVOLUT_BUSINESS_BASE_URL: z.url().default("https://b2b.revolut.com/api/1.0"),
  REVOLUT_CLIENT_ID: z.string().optional(),
  REVOLUT_ISSUER_DOMAIN: z.string().optional(),
  REVOLUT_REFRESH_TOKEN: z.string().optional(),
  REVOLUT_PRIVATE_KEY_PEM: z.string().optional(),
  PROFIT_SWEEP_ENABLED: boolString,
  PROFIT_SWEEP_THRESHOLD_EUR: numberString(100).pipe(z.number().nonnegative()),
  PROFIT_SWEEP_PERCENT: numberString(25).pipe(z.number().min(0).max(100)),
  BACKTEST_COMMISSION_PER_ORDER: numberString(0.01).pipe(z.number().min(0).max(100)),
  BACKTEST_SLIPPAGE_BPS: numberString(5).pipe(z.number().min(0).max(500)),
  CRON_SECRET: z.string().optional()
});

let cached: ReturnType<typeof envSchema.parse> | undefined;

export function getEnv() {
  if (!cached) {
    cached = envSchema.parse(process.env);
    const gate = validateLiveTradingGate({
      tradingMode: cached.TRADING_MODE,
      enableLiveTrading: String(cached.ENABLE_LIVE_TRADING),
      liveTradingAcknowledged: String(cached.LIVE_TRADING_ACKNOWLEDGED),
      brokerProvider: cached.BROKER_PROVIDER,
      brokerApiKey: cached.ALPACA_API_KEY,
      brokerApiSecret: cached.ALPACA_API_SECRET
    });
    if (!gate.allowed) throw new Error(`Unsafe live-trading configuration: ${gate.reasons.join(", ")}`);
    if (!cached.DEMO_MODE && !cached.DATABASE_URL) throw new Error("DATABASE_URL is required outside demo mode");
    if (!cached.DEMO_MODE) {
      if (cached.AUTH_MODE !== "single-user") throw new Error("AUTH_MODE=single-user is required outside demo mode");
      if (!/^[a-f0-9]{64}$/i.test(cached.APP_ACCESS_CODE_SHA256 ?? "")) throw new Error("APP_ACCESS_CODE_SHA256 must be a SHA-256 hex digest outside demo mode");
      if ((cached.APP_SESSION_SECRET?.length ?? 0) < 32) throw new Error("APP_SESSION_SECRET must be at least 32 characters outside demo mode");
    }
  }
  return cached;
}

export function riskConfigFromEnv() {
  const env = getEnv();
  return {
    maxRiskPerTradePercent: env.MAX_RISK_PER_TRADE_PERCENT,
    maxDailyLossPercent: env.MAX_DAILY_LOSS_PERCENT,
    maxTotalExposurePercent: env.MAX_TOTAL_EXPOSURE_PERCENT,
    maxSinglePositionPercent: env.MAX_SINGLE_POSITION_PERCENT,
    maxOpenPositions: env.MAX_OPEN_POSITIONS,
    minCashReservePercent: env.MIN_CASH_RESERVE_PERCENT,
    maxSpreadBps: env.MAX_SPREAD_BPS,
    maxQuoteAgeSeconds: env.MAX_QUOTE_AGE_SECONDS,
    maxAtrPercent: env.MAX_ATR_PERCENT,
    minAverageDollarVolume: env.MIN_AVERAGE_DOLLAR_VOLUME,
    lossStreakCooldownCount: env.LOSS_STREAK_COOLDOWN_COUNT,
    lossStreakCooldownMinutes: env.LOSS_STREAK_COOLDOWN_MINUTES,
    killSwitch: env.KILL_SWITCH
  };
}
