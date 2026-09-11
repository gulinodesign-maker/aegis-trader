import type { DepositRequest, FundingProvider, WithdrawalRequest } from "./FundingProvider";

export class SepaFundingProvider implements FundingProvider {
  readonly name = "sepa-manual";
  async getBalance(currency = "EUR") { return { currency, available: 0, source: "manual-sepa-unlinked" }; }
  async createDeposit(request: DepositRequest) {
    return { id: `sepa-deposit-${Date.now()}`, status: "MANUAL_ACTION_REQUIRED" as const, message: `Create a manual ${request.currency} SEPA transfer from your funding account to the broker using only the broker-provided bank instructions. No money is held by this app.` };
  }
  async requestWithdrawal(request: WithdrawalRequest) {
    return { id: `sepa-withdraw-${Date.now()}`, status: "MANUAL_ACTION_REQUIRED" as const, message: `Request a ${request.currency} withdrawal in the broker UI/API to your verified funding bank account. V1 never auto-sends this transfer.` };
  }
  async getTransactions() { return []; }
  async reconcileTransfer() { return { matched: false }; }
}
