export interface PositionSizingInput {
  accountEquity: number;
  cash: number;
  entry: number;
  stop: number;
  riskPercent: number;
  minCashReservePercent: number;
  maxSinglePositionPercent: number;
  fxRateToAccountCurrency: number;
  supportsFractional: boolean;
  quantityStep?: number;
}

export interface PositionSizingResult {
  quantity: number;
  riskCapital: number;
  riskPerShareAccountCurrency: number;
  maxLoss: number;
  notionalAccountCurrency: number;
  limitedBy: Array<"RISK" | "CASH_RESERVE" | "SINGLE_POSITION" | "WHOLE_SHARES">;
}

function floorToStep(value: number, step: number) {
  if (step <= 0) throw new Error("quantityStep must be > 0");
  const floored = Math.floor((value + Number.EPSILON) / step) * step;
  const decimalPart = String(step).split(".")[1];
  const precision = decimalPart ? Math.min(decimalPart.length, 12) : 0;
  return Number(floored.toFixed(precision));
}

export function calculatePositionSize(input: PositionSizingInput): PositionSizingResult {
  const { accountEquity, cash, entry, stop, riskPercent, minCashReservePercent, maxSinglePositionPercent, fxRateToAccountCurrency } = input;
  if (![accountEquity, cash, entry, stop, riskPercent, minCashReservePercent, maxSinglePositionPercent, fxRateToAccountCurrency].every(Number.isFinite)) {
    throw new Error("Position sizing inputs must be finite numbers");
  }
  if (accountEquity <= 0 || cash < 0 || entry <= 0 || stop <= 0 || entry === stop || riskPercent <= 0 || fxRateToAccountCurrency <= 0) {
    return { quantity: 0, riskCapital: 0, riskPerShareAccountCurrency: 0, maxLoss: 0, notionalAccountCurrency: 0, limitedBy: [] };
  }

  const riskCapital = accountEquity * (riskPercent / 100);
  const riskPerShareAccountCurrency = Math.abs(entry - stop) * fxRateToAccountCurrency;
  const qtyByRisk = riskCapital / riskPerShareAccountCurrency;

  const reservedCash = accountEquity * (minCashReservePercent / 100);
  const spendableCash = Math.max(0, cash - reservedCash);
  const entryAccountCurrency = entry * fxRateToAccountCurrency;
  const qtyByCash = spendableCash / entryAccountCurrency;

  const singlePositionCap = accountEquity * (maxSinglePositionPercent / 100);
  const qtyBySinglePosition = singlePositionCap / entryAccountCurrency;

  const raw = Math.max(0, Math.min(qtyByRisk, qtyByCash, qtyBySinglePosition));
  const step = input.supportsFractional ? (input.quantityStep ?? 0.000001) : 1;
  const quantity = floorToStep(raw, step);

  const limitedBy: PositionSizingResult["limitedBy"] = [];
  const epsilon = 1e-9;
  if (Math.abs(raw - qtyByRisk) < epsilon) limitedBy.push("RISK");
  if (Math.abs(raw - qtyByCash) < epsilon) limitedBy.push("CASH_RESERVE");
  if (Math.abs(raw - qtyBySinglePosition) < epsilon) limitedBy.push("SINGLE_POSITION");
  if (!input.supportsFractional && raw > 0 && quantity !== raw) limitedBy.push("WHOLE_SHARES");

  return {
    quantity,
    riskCapital,
    riskPerShareAccountCurrency,
    maxLoss: quantity * riskPerShareAccountCurrency,
    notionalAccountCurrency: quantity * entryAccountCurrency,
    limitedBy
  };
}

export function calculateRiskReward(entry: number, stop: number, target: number) {
  const risk = Math.abs(entry - stop);
  if (!Number.isFinite(risk) || risk <= 0) return 0;
  return Math.abs(target - entry) / risk;
}
