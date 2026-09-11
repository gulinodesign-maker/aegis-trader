import "server-only";
import type { DepositRequest, FundingProvider, FundingTransaction, WithdrawalRequest } from "./FundingProvider";

/**
 * Official Revolut Business API only. No personal-app login automation,
 * private endpoints, reverse engineering, or browser credential storage.
 * V1 reads accounts/transactions for reconciliation; money movement remains manual.
 */
export class RevolutFundingProvider implements FundingProvider {
  readonly name = "revolut-business";
  constructor(private readonly config: { enabled: boolean; baseUrl: string; getAccessToken: () => Promise<string> }) {}

  private async get<T>(path: string): Promise<T> {
    if (!this.config.enabled) throw new Error("REVOLUT_BUSINESS_API_DISABLED");
    const accessToken = await this.config.getAccessToken();
    const response = await fetch(`${this.config.baseUrl}${path}`, { headers: { authorization: `Bearer ${accessToken}` }, cache: "no-store" });
    if (!response.ok) throw new Error(`REVOLUT_BUSINESS_HTTP_${response.status}`);
    return response.json() as Promise<T>;
  }

  async getBalance(currency = "EUR") {
    const accounts = await this.get<Array<{ balance: number; currency: string; state: string }>>("/accounts");
    const available = accounts.filter(a => a.currency === currency && a.state === "active").reduce((sum, a) => sum + Number(a.balance), 0);
    return { currency, available, source: "revolut-business-official-api" };
  }

  async createDeposit(request: DepositRequest) {
    return { id: `revolut-deposit-${Date.now()}`, status: "MANUAL_ACTION_REQUIRED" as const, message: `Use a manual SEPA transfer from Revolut to the broker's verified bank details for ${request.amount.toFixed(2)} ${request.currency}. The app can reconcile it from official Business API transactions.` };
  }

  async requestWithdrawal(request: WithdrawalRequest) {
    return { id: `revolut-withdraw-${Date.now()}`, status: "MANUAL_ACTION_REQUIRED" as const, message: `Request ${request.amount.toFixed(2)} ${request.currency} from the broker to your verified Revolut bank account. V1 does not initiate this transfer.` };
  }

  async getTransactions(): Promise<FundingTransaction[]> {
    const rows = await this.get<Array<{ id: string; state: string; created_at: string; reference?: string; legs?: Array<{ amount: number; currency: string }> }>>("/transactions?count=100");
    return rows.map(row => {
      const leg = row.legs?.[0];
      return { id: row.id, amount: Number(leg?.amount ?? 0), currency: leg?.currency ?? "UNKNOWN", state: row.state, createdAt: row.created_at, reference: row.reference };
    });
  }

  async reconcileTransfer(input: { amount: number; currency: string; reference?: string; tolerance?: number }) {
    const tolerance = input.tolerance ?? 0.01;
    const transactions = await this.getTransactions();
    const transaction = transactions.find(tx => tx.currency === input.currency && Math.abs(Math.abs(tx.amount) - Math.abs(input.amount)) <= tolerance && (!input.reference || tx.reference === input.reference));
    return { matched: Boolean(transaction), transaction };
  }
}
