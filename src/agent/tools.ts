import type { BrokerAdapter } from "../broker/BrokerAdapter";
import type { MarketDataProvider } from "../market/MarketDataProvider";
import type { Signal } from "../domain/types";
import { calculateAssetMetrics, generateSignal } from "../signal/signal-engine";
import { calculatePositionSize, calculateRiskReward } from "../risk/position-sizing";
import { backtestLongSignals } from "../backtest/backtester";
import { TradeProposalSchema } from "./schema";

export const agentToolDefinitions = [
  tool("get_market_status", "Get the current market clock. Use before proposing a trade.", {}, []),
  tool("scan_market", "Scan a caller-supplied symbol universe and return quantitative signals. Prices must come from tools, never guess them.", { symbols: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 20 } }, ["symbols"]),
  tool("get_quote", "Get a timestamped current quote for one symbol.", { symbol: { type: "string" } }, ["symbol"]),
  tool("get_candles", "Get recent candles for a symbol and timeframe.", { symbol: { type: "string" }, timeframe: { type: "string" }, limit: { type: "integer", minimum: 20, maximum: 500 } }, ["symbol", "timeframe", "limit"]),
  tool("get_asset_metrics", "Calculate EMA, RSI, ATR, VWAP, trend, support/resistance and relative volume from provider candles.", { symbol: { type: "string" }, timeframe: { type: "string" } }, ["symbol", "timeframe"]),
  tool("get_signal", "Get the quantitative signal for a symbol. The signal engine, not the LLM, calculates entry, stop, target and score.", { symbol: { type: "string" }, timeframe: { type: "string" } }, ["symbol", "timeframe"]),
  tool("get_portfolio", "Get current broker account and positions.", {}, []),
  tool("get_open_positions", "Get open positions only.", {}, []),
  tool("calculate_position_size", "Calculate deterministic position size from account equity, stop distance and risk limits.", { symbol: { type: "string" }, entry: { type: "number" }, stop: { type: "number" } }, ["symbol", "entry", "stop"]),
  tool("calculate_trade_risk", "Calculate deterministic risk/reward and maximum loss for a proposed long trade. This does not approve or execute the trade.", { symbol: { type: "string" }, entry: { type: "number" }, stop: { type: "number" }, target: { type: "number" } }, ["symbol", "entry", "stop", "target"]),
  tool("backtest_signal", "Run a simple historical signal backtest with simulated commissions and slippage. Do not infer profitability from win rate alone.", { symbol: { type: "string" }, timeframe: { type: "string" } }, ["symbol", "timeframe"]),
  tool("propose_trade", "Validate a structured BUY/WAIT/CLOSE proposal. This tool NEVER sends an order to a broker.", {
    symbol: { type: "string" }, action: { type: "string", enum: ["BUY", "WAIT", "CLOSE"] }, confidence: { type: "number", minimum: 0, maximum: 100 }, entry: { type: "number", minimum: 0 }, stopLoss: { type: "number", minimum: 0 }, takeProfit: { type: "number", minimum: 0 }, riskReward: { type: "number", minimum: 0 }, positionSize: { type: "number", minimum: 0 }, thesis: { type: "string" }, invalidation: { type: "string" }, signalIds: { type: "array", items: { type: "string" } }
  }, ["symbol", "action", "confidence", "entry", "stopLoss", "takeProfit", "riskReward", "positionSize", "thesis", "invalidation", "signalIds"])
] as const;

function tool(name: string, description: string, properties: Record<string, unknown>, required: string[]) {
  return { type: "function", name, description, strict: true, parameters: { type: "object", properties, required, additionalProperties: false } } as const;
}

export interface AgentToolContext {
  marketData: MarketDataProvider;
  broker: BrokerAdapter;
  universe: string[];
  risk: { maxRiskPerTradePercent: number; minCashReservePercent: number; maxSinglePositionPercent: number };
  fxRateToAccountCurrency: number;
}

export async function executeAgentTool(name: string, args: Record<string, unknown>, context: AgentToolContext): Promise<unknown> {
  switch (name) {
    case "get_market_status": return context.marketData.getMarketClock();
    case "get_quote": return context.marketData.getQuote(String(args.symbol));
    case "get_candles": return context.marketData.getCandles(String(args.symbol), String(args.timeframe), Number(args.limit));
    case "scan_market": {
      const symbols = (args.symbols as string[]).filter(s => context.universe.includes(s.toUpperCase()));
      const signals: Signal[] = [];
      for (const symbol of symbols) {
        const candles = await context.marketData.getCandles(symbol, "5Min", 200);
        const signal = generateSignal(candles);
        if (signal) signals.push(signal);
      }
      return signals.sort((a, b) => b.score - a.score);
    }
    case "get_asset_metrics": {
      const candles = await context.marketData.getCandles(String(args.symbol), String(args.timeframe), 200);
      return calculateAssetMetrics(candles);
    }
    case "get_signal": {
      const candles = await context.marketData.getCandles(String(args.symbol), String(args.timeframe), 200);
      return generateSignal(candles);
    }
    case "get_portfolio": return { account: await context.broker.getAccount(), positions: await context.broker.getPositions() };
    case "get_open_positions": return context.broker.getPositions();
    case "calculate_position_size": {
      const account = await context.broker.getAccount();
      return calculatePositionSize({ accountEquity: account.equity, cash: account.cash, entry: Number(args.entry), stop: Number(args.stop), riskPercent: context.risk.maxRiskPerTradePercent, minCashReservePercent: context.risk.minCashReservePercent, maxSinglePositionPercent: context.risk.maxSinglePositionPercent, fxRateToAccountCurrency: context.fxRateToAccountCurrency, supportsFractional: context.broker.capabilities.fractionalShares });
    }
    case "calculate_trade_risk": {
      const entry = Number(args.entry), stop = Number(args.stop), target = Number(args.target);
      const sizing = await executeAgentTool("calculate_position_size", { symbol: args.symbol, entry, stop }, context);
      return { riskReward: calculateRiskReward(entry, stop, target), sizing };
    }
    case "backtest_signal": {
      const candles = await context.marketData.getCandles(String(args.symbol), String(args.timeframe), 300);
      const points = [] as Array<{ index: number; score: number; atr: number }>;
      for (let i = 60; i < candles.length - 1; i += 5) {
        const signal = generateSignal(candles.slice(0, i + 1));
        if (signal) points.push({ index: i, score: signal.score, atr: signal.metrics.atr });
      }
      return backtestLongSignals(candles, points, { initialCapital: 20, riskPercent: context.risk.maxRiskPerTradePercent, commissionPerTrade: 0, slippageBps: 5, stopAtrMultiple: 1.5, targetRiskReward: 2 });
    }
    case "propose_trade": return TradeProposalSchema.parse(args);
    default: throw new Error(`UNKNOWN_AGENT_TOOL:${name}`);
  }
}
