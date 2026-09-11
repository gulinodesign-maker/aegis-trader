import type { BrokerAdapter } from "../broker/BrokerAdapter";
import type { BrokerOrder, RiskConfig, RiskContext, RiskDecision, TradeProposal } from "../domain/types";
import { evaluateTradeRisk } from "../risk/risk-engine";
import { createClientOrderId, createOrderIdempotencyKey } from "../security/idempotency";

export interface ExecutionIntent {
  idempotencyKey: string;
  clientOrderId: string;
  mode: "paper" | "live";
  symbol: string;
  quantity: number;
  stopLoss: number;
  takeProfit: number;
  proposalId: string;
}

export interface ExecutionIdempotencyStore {
  claim(intent: ExecutionIntent): Promise<{ claimed: boolean; recordId?: string }>;
  complete(recordId: string | undefined, order: BrokerOrder): Promise<void>;
  fail(recordId: string | undefined, code: string): Promise<void>;
}

export interface ExecutionResult {
  executed: boolean;
  risk: RiskDecision;
  order?: BrokerOrder;
  persistenceId?: string;
}

export class ExecutionEngine {
  constructor(
    private readonly broker: BrokerAdapter,
    private readonly riskConfig: RiskConfig | (() => Promise<RiskConfig>),
    private readonly idempotencyStore?: ExecutionIdempotencyStore
  ) {}

  /** The only path from a proposal to submitOrder(). Risk is recomputed here. */
  async executeBuy(
    proposal: TradeProposal,
    context: RiskContext,
    options: { observedAtrPercent?: number; observedAverageDollarVolume?: number } = {}
  ): Promise<ExecutionResult> {
    const config = typeof this.riskConfig === "function" ? await this.riskConfig() : this.riskConfig;
    const risk = evaluateTradeRisk(
      proposal,
      context,
      config,
      { supportsFractional: this.broker.capabilities.fractionalShares, observedAtrPercent: options.observedAtrPercent, observedAverageDollarVolume: options.observedAverageDollarVolume }
    );

    if (!risk.approved || risk.quantity <= 0) return { executed: false, risk };
    if (!proposal.stopLoss || proposal.stopLoss <= 0) {
      return { executed: false, risk: { ...risk, approved: false, quantity: 0, maxLoss: 0, reasons: [...risk.reasons, "STOP_LOSS_REQUIRED"] } };
    }

    const clientOrderId = createClientOrderId();
    const idempotencyKey = createOrderIdempotencyKey({
      accountId: context.account.id,
      proposalId: proposal.id,
      symbol: proposal.symbol,
      side: "BUY"
    });
    const intent: ExecutionIntent = {
      idempotencyKey, clientOrderId, mode: context.account.mode, symbol: proposal.symbol,
      quantity: risk.quantity, stopLoss: proposal.stopLoss, takeProfit: proposal.takeProfit, proposalId: proposal.id
    };
    const claim = this.idempotencyStore ? await this.idempotencyStore.claim(intent) : { claimed: true as const, recordId: undefined };
    if (!claim.claimed) {
      return { executed: false, persistenceId: claim.recordId, risk: { ...risk, approved: false, quantity: 0, maxLoss: 0, reasons: [...risk.reasons, "DUPLICATE_ORDER"] } };
    }

    try {
      const order = await this.broker.submitOrder({
        symbol: proposal.symbol,
        side: "BUY",
        quantity: risk.quantity,
        type: "MARKET",
        stopLoss: proposal.stopLoss,
        takeProfit: proposal.takeProfit,
        clientOrderId,
        idempotencyKey
      });
      await this.idempotencyStore?.complete(claim.recordId, order);
      return { executed: true, risk, order, persistenceId: claim.recordId };
    } catch (error) {
      await this.idempotencyStore?.fail(claim.recordId, error instanceof Error ? error.message : "BROKER_SUBMIT_FAILED");
      throw error;
    }
  }
}
