export interface FundingBalance { currency: string; available: number; source: string; }
export interface DepositRequest { amount: number; currency: string; brokerReference?: string; }
export interface WithdrawalRequest { amount: number; currency: string; brokerReference?: string; }
export interface FundingTransaction { id: string; amount: number; currency: string; state: string; createdAt: string; reference?: string; }
export interface FundingInstruction { id: string; status: "MANUAL_ACTION_REQUIRED" | "PENDING" | "COMPLETED"; message: string; }

export interface FundingProvider {
  readonly name: string;
  getBalance(currency?: string): Promise<FundingBalance>;
  createDeposit(request: DepositRequest): Promise<FundingInstruction>;
  requestWithdrawal(request: WithdrawalRequest): Promise<FundingInstruction>;
  getTransactions(): Promise<FundingTransaction[]>;
  reconcileTransfer(input: { amount: number; currency: string; reference?: string; tolerance?: number }): Promise<{ matched: boolean; transaction?: FundingTransaction }>;
}
