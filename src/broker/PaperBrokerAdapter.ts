import type { AccountSnapshot, BrokerOrder, OrderRequest, Position } from "../domain/types";
import type { MarketDataProvider } from "../market/MarketDataProvider";
import type { BrokerAdapter } from "./BrokerAdapter";
import { InMemoryIdempotencyStore } from "../security/idempotency";

export class PaperBrokerAdapter implements BrokerAdapter {
  readonly name = "paper";
  readonly capabilities = { fractionalShares: true, bracketOrders: true, paperTrading: true, shortSelling: false, margin: false } as const;
  private cash: number;
  private readonly initialCapital: number;
  private readonly positions = new Map<string, Position>();
  private readonly orders = new Map<string, BrokerOrder>();
  private readonly idempotency = new InMemoryIdempotencyStore();

  constructor(private readonly marketData: MarketDataProvider, initialCapital = 20, private readonly fxRateToAccountCurrency = 0.92) {
    this.cash = initialCapital;
    this.initialCapital = initialCapital;
  }

  async getAccount(): Promise<AccountSnapshot> {
    const positions = await this.getPositions();
    const marketValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
    const equity = this.cash + marketValue;
    return { id: "paper-local", currency: "EUR", equity, cash: this.cash, buyingPower: this.cash, todayPnl: equity - this.initialCapital, totalPnl: equity - this.initialCapital, mode: "paper" };
  }
  async getCash() { return this.cash; }
  async getPositions() {
    const refreshed: Position[] = [];
    for (const position of this.positions.values()) {
      const quote = await this.marketData.getQuote(position.symbol);
      const currentPrice = quote.last;
      const marketValue = currentPrice * position.quantity * this.fxRateToAccountCurrency;
      refreshed.push({ ...position, currentPrice, marketValue, unrealizedPnl: (currentPrice - position.averageEntry) * position.quantity * this.fxRateToAccountCurrency });
    }
    return refreshed;
  }
  async getOrders() { return Array.from(this.orders.values()); }
  getQuote(symbol: string) { return this.marketData.getQuote(symbol); }
  getCandles(symbol: string, timeframe: string) { return this.marketData.getCandles(symbol, timeframe); }
  getMarketClock() { return this.marketData.getMarketClock(); }

  async submitOrder(request: OrderRequest): Promise<BrokerOrder> {
    if (request.side !== "BUY") throw new Error("Paper V1 opens long positions only");
    if (!request.stopLoss || request.stopLoss <= 0) throw new Error("STOP_LOSS_REQUIRED");
    if (!this.idempotency.claim(request.idempotencyKey)) throw new Error("DUPLICATE_ORDER");
    const existingClientId = Array.from(this.orders.values()).find(order => order.clientOrderId === request.clientOrderId);
    if (existingClientId) { this.idempotency.release(request.idempotencyKey); throw new Error("DUPLICATE_CLIENT_ORDER_ID"); }

    try {
      const quote = await this.marketData.getQuote(request.symbol);
      const fillPrice = request.type === "LIMIT" && request.limitPrice ? Math.min(request.limitPrice, quote.ask) : quote.ask;
      const notional = fillPrice * request.quantity * this.fxRateToAccountCurrency;
      if (notional > this.cash + 1e-9) throw new Error("INSUFFICIENT_CASH");
      this.cash -= notional;
      const now = new Date().toISOString();
      const order: BrokerOrder = { id: `paper-${request.clientOrderId}`, clientOrderId: request.clientOrderId, symbol: request.symbol, side: "BUY", quantity: request.quantity, filledQuantity: request.quantity, status: "FILLED", averageFillPrice: fillPrice, submittedAt: now, updatedAt: now };
      this.orders.set(order.id, order);
      const existing = this.positions.get(request.symbol);
      if (existing) {
        const combinedQty = existing.quantity + request.quantity;
        const averageEntry = (existing.averageEntry * existing.quantity + fillPrice * request.quantity) / combinedQty;
        this.positions.set(request.symbol, { ...existing, quantity: combinedQty, averageEntry, currentPrice: fillPrice, marketValue: combinedQty * fillPrice * this.fxRateToAccountCurrency, unrealizedPnl: 0, stopLoss: Math.max(existing.stopLoss, request.stopLoss), takeProfit: Math.max(existing.takeProfit, request.takeProfit) });
      } else {
        this.positions.set(request.symbol, { symbol: request.symbol, quantity: request.quantity, averageEntry: fillPrice, currentPrice: fillPrice, marketValue: notional, unrealizedPnl: 0, stopLoss: request.stopLoss, takeProfit: request.takeProfit, openedAt: now });
      }
      return order;
    } catch (error) {
      this.idempotency.release(request.idempotencyKey);
      throw error;
    }
  }

  async cancelOrder(orderId: string) {
    const order = this.orders.get(orderId);
    if (!order) throw new Error("ORDER_NOT_FOUND");
    if (order.status === "FILLED") throw new Error("FILLED_ORDER_CANNOT_BE_CANCELED");
    this.orders.set(orderId, { ...order, status: "CANCELED", updatedAt: new Date().toISOString() });
  }

  async closePosition(symbol: string): Promise<BrokerOrder> {
    const position = this.positions.get(symbol);
    if (!position) throw new Error("POSITION_NOT_FOUND");
    const quote = await this.marketData.getQuote(symbol);
    const proceeds = quote.bid * position.quantity * this.fxRateToAccountCurrency;
    this.cash += proceeds;
    this.positions.delete(symbol);
    const now = new Date().toISOString();
    const order: BrokerOrder = { id: `paper-close-${symbol}-${Date.now()}`, clientOrderId: `close-${symbol}-${Date.now()}`, symbol, side: "SELL", quantity: position.quantity, filledQuantity: position.quantity, status: "FILLED", averageFillPrice: quote.bid, submittedAt: now, updatedAt: now };
    this.orders.set(order.id, order);
    return order;
  }

  async getOrderStatus(orderId: string) {
    const order = this.orders.get(orderId);
    if (!order) throw new Error("ORDER_NOT_FOUND");
    return order;
  }
}
