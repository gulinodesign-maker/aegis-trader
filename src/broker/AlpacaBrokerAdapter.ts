import "server-only";
import type { AccountSnapshot, BrokerOrder, OrderRequest, Position } from "../domain/types";
import type { MarketDataProvider } from "../market/MarketDataProvider";
import type { BrokerAdapter } from "./BrokerAdapter";

interface AlpacaOrder {
  id: string; client_order_id: string; symbol: string; side: "buy" | "sell"; qty: string; filled_qty: string;
  status: string; filled_avg_price?: string | null; submitted_at: string; updated_at: string;
}

export class AlpacaBrokerAdapter implements BrokerAdapter {
  readonly name = "alpaca";
  readonly capabilities = { fractionalShares: true, bracketOrders: true, paperTrading: true, shortSelling: false, margin: false } as const;

  constructor(private readonly config: { key: string; secret: string; baseUrl: string; mode: "paper" | "live" }, private readonly marketData: MarketDataProvider) {}

  private headers(extra: Record<string, string> = {}) { return { "APCA-API-KEY-ID": this.config.key, "APCA-API-SECRET-KEY": this.config.secret, "content-type": "application/json", ...extra }; }
  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.config.baseUrl}${path}`, { ...init, headers: { ...this.headers(), ...(init.headers ?? {}) }, cache: "no-store" });
    if (!response.ok) throw new Error(`ALPACA_HTTP_${response.status}`);
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
  private normalizeOrder(order: AlpacaOrder): BrokerOrder {
    const statusMap: Record<string, BrokerOrder["status"]> = { new: "NEW", accepted: "ACCEPTED", filled: "FILLED", partially_filled: "PARTIALLY_FILLED", canceled: "CANCELED", rejected: "REJECTED" };
    return { id: order.id, clientOrderId: order.client_order_id, symbol: order.symbol, side: order.side === "buy" ? "BUY" : "SELL", quantity: Number(order.qty), filledQuantity: Number(order.filled_qty), status: statusMap[order.status] ?? "ACCEPTED", averageFillPrice: order.filled_avg_price ? Number(order.filled_avg_price) : undefined, submittedAt: order.submitted_at, updatedAt: order.updated_at };
  }

  async getAccount(): Promise<AccountSnapshot> {
    const a = await this.request<{ id: string; equity: string; cash: string; buying_power: string; last_equity: string }>("/v2/account");
    const equity = Number(a.equity), last = Number(a.last_equity);
    return { id: a.id, currency: "USD", equity, cash: Number(a.cash), buyingPower: Number(a.buying_power), todayPnl: equity - last, totalPnl: 0, mode: this.config.mode };
  }
  async getCash() { return (await this.getAccount()).cash; }
  async getPositions(): Promise<Position[]> {
    const rows = await this.request<Array<{ symbol: string; qty: string; avg_entry_price: string; current_price: string; market_value: string; unrealized_pl: string }>>("/v2/positions");
    return rows.map(row => ({ symbol: row.symbol, quantity: Number(row.qty), averageEntry: Number(row.avg_entry_price), currentPrice: Number(row.current_price), marketValue: Number(row.market_value), unrealizedPnl: Number(row.unrealized_pl), stopLoss: 0, takeProfit: 0, openedAt: "" }));
  }
  async getOrders() { return (await this.request<AlpacaOrder[]>("/v2/orders?status=all&nested=true&limit=100")).map(o => this.normalizeOrder(o)); }
  getQuote(symbol: string) { return this.marketData.getQuote(symbol); }
  getCandles(symbol: string, timeframe: string) { return this.marketData.getCandles(symbol, timeframe); }
  getMarketClock() { return this.marketData.getMarketClock(); }

  async submitOrder(order: OrderRequest) {
    if (order.side !== "BUY") throw new Error("V1_NEW_ORDERS_ARE_LONG_ONLY");
    if (!order.stopLoss) throw new Error("STOP_LOSS_REQUIRED");
    const body = {
      symbol: order.symbol,
      qty: order.quantity.toFixed(6).replace(/0+$/, "").replace(/\.$/, ""),
      side: "buy",
      type: order.type.toLowerCase(),
      ...(order.type === "LIMIT" ? { limit_price: order.limitPrice } : {}),
      time_in_force: "day",
      order_class: "bracket",
      take_profit: { limit_price: order.takeProfit },
      stop_loss: { stop_price: order.stopLoss },
      client_order_id: order.clientOrderId,
      extended_hours: false
    };
    return this.normalizeOrder(await this.request<AlpacaOrder>("/v2/orders", { method: "POST", body: JSON.stringify(body) }));
  }
  async cancelOrder(orderId: string) { await this.request<void>(`/v2/orders/${encodeURIComponent(orderId)}`, { method: "DELETE" }); }
  async closePosition(symbol: string) { return this.normalizeOrder(await this.request<AlpacaOrder>(`/v2/positions/${encodeURIComponent(symbol)}`, { method: "DELETE" })); }
  async getOrderStatus(orderId: string) { return this.normalizeOrder(await this.request<AlpacaOrder>(`/v2/orders/${encodeURIComponent(orderId)}`)); }
}
