export type TradingMode = "paper" | "live";
export type ExecutionMode = "MANUAL" | "ASSISTED" | "AUTO";
export type TradeAction = "BUY" | "WAIT" | "CLOSE";
export type Direction = "LONG";
export type DataOrigin = "DEMO" | "ALPACA" | "DATABASE";

export interface Timestamped {
  timestamp: string;
}

export interface Quote extends Timestamped {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  currency: "USD" | "EUR";
  origin: DataOrigin;
}

export interface Candle {
  symbol: string;
  timeframe: string;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
  origin: DataOrigin;
}

export interface AssetMetrics {
  symbol: string;
  emaFast: number;
  emaSlow: number;
  rsi: number;
  atr: number;
  atrPercent: number;
  relativeVolume: number;
  support: number;
  resistance: number;
  vwap?: number;
  trend: "UP" | "DOWN" | "FLAT";
  volatility: "LOW" | "NORMAL" | "HIGH";
}

export interface Signal {
  id: string;
  symbol: string;
  direction: Direction;
  score: number;
  entry: number;
  stop: number;
  target: number;
  riskReward: number;
  reasons: string[];
  invalidations: string[];
  metrics: AssetMetrics;
  generatedAt: string;
  dataTimestamp: string;
  origin: DataOrigin;
}

export interface TradeProposal {
  id: string;
  symbol: string;
  action: TradeAction;
  confidence: number;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  positionSize: number;
  thesis: string;
  invalidation: string;
  signalIds: string[];
  createdAt: string;
}

export interface AccountSnapshot {
  id: string;
  currency: "EUR" | "USD";
  equity: number;
  cash: number;
  buyingPower: number;
  todayPnl: number;
  totalPnl: number;
  mode: TradingMode;
}

export interface Position {
  symbol: string;
  quantity: number;
  averageEntry: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  stopLoss: number;
  takeProfit: number;
  openedAt: string;
}

export interface OrderRequest {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  type: "MARKET" | "LIMIT";
  limitPrice?: number;
  stopLoss: number;
  takeProfit: number;
  clientOrderId: string;
  idempotencyKey: string;
}

export interface BrokerOrder {
  id: string;
  clientOrderId: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  filledQuantity: number;
  status: "NEW" | "ACCEPTED" | "FILLED" | "PARTIALLY_FILLED" | "CANCELED" | "REJECTED";
  averageFillPrice?: number;
  submittedAt: string;
  updatedAt: string;
}

export interface MarketClock {
  isOpen: boolean;
  timestamp: string;
  nextOpen?: string;
  nextClose?: string;
}

export interface RiskConfig {
  maxRiskPerTradePercent: number;
  maxDailyLossPercent: number;
  maxTotalExposurePercent: number;
  maxSinglePositionPercent: number;
  maxOpenPositions: number;
  minCashReservePercent: number;
  maxSpreadBps: number;
  maxQuoteAgeSeconds: number;
  maxAtrPercent: number;
  minAverageDollarVolume: number;
  lossStreakCooldownCount: number;
  lossStreakCooldownMinutes: number;
  killSwitch: boolean;
}

export interface RiskContext {
  now: Date;
  account: AccountSnapshot;
  positions: Position[];
  quote: Quote;
  marketClock: MarketClock;
  dailyRealizedPnl: number;
  consecutiveLosses: number;
  lastLossAt?: Date;
  totalExposure: number;
  /** Account-currency units per one quote-currency unit (e.g. EUR per USD). */
  fxRateToAccountCurrency: number;
}

export interface RiskDecision {
  approved: boolean;
  reasons: string[];
  quantity: number;
  riskCapital: number;
  maxLoss: number;
  exposureAfter: number;
}

export interface BacktestTrade {
  symbol: string;
  enteredAt: string;
  exitedAt: string;
  entry: number;
  exit: number;
  quantity: number;
  grossPnl: number;
  commission: number;
  slippage: number;
  netPnl: number;
}

export interface BacktestResult {
  trades: BacktestTrade[];
  tradeCount: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  expectancy: number;
  profitFactor: number | null;
  sharpeRatio: number | null;
  maxDrawdown: number;
  initialCapital: number;
  finalCapital: number;
  commissions: number;
  slippage: number;
}
