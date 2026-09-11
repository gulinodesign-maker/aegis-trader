import type { AccountSnapshot, BrokerOrder, Candle, MarketClock, OrderRequest, Position, Quote } from "../domain/types";

export interface BrokerCapabilities {
  fractionalShares: boolean;
  bracketOrders: boolean;
  paperTrading: boolean;
  shortSelling: boolean;
  margin: boolean;
}

export interface BrokerAdapter {
  readonly name: string;
  readonly capabilities: BrokerCapabilities;
  getAccount(): Promise<AccountSnapshot>;
  getCash(): Promise<number>;
  getPositions(): Promise<Position[]>;
  getOrders(): Promise<BrokerOrder[]>;
  getQuote(symbol: string): Promise<Quote>;
  getCandles(symbol: string, timeframe: string): Promise<Candle[]>;
  submitOrder(order: OrderRequest): Promise<BrokerOrder>;
  cancelOrder(orderId: string): Promise<void>;
  closePosition(symbol: string): Promise<BrokerOrder>;
  getOrderStatus(orderId: string): Promise<BrokerOrder>;
  getMarketClock(): Promise<MarketClock>;
}
