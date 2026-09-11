import { z } from "zod";

export const TradeProposalSchema = z.object({
  symbol: z.string().min(1).max(12).regex(/^[A-Z./-]+$/),
  action: z.enum(["BUY", "WAIT", "CLOSE"]),
  confidence: z.number().min(0).max(100),
  entry: z.number().nonnegative(),
  stopLoss: z.number().nonnegative(),
  takeProfit: z.number().nonnegative(),
  riskReward: z.number().nonnegative(),
  positionSize: z.number().nonnegative(),
  thesis: z.string().max(2000),
  invalidation: z.string().max(1000),
  signalIds: z.array(z.string()).max(20)
}).superRefine((value, ctx) => {
  if (value.action === "BUY") {
    if (value.entry <= 0) ctx.addIssue({ code: "custom", path: ["entry"], message: "BUY requires entry > 0" });
    if (value.stopLoss <= 0) ctx.addIssue({ code: "custom", path: ["stopLoss"], message: "BUY requires stopLoss > 0" });
    if (value.stopLoss >= value.entry) ctx.addIssue({ code: "custom", path: ["stopLoss"], message: "LONG stop must be below entry" });
    if (value.takeProfit <= value.entry) ctx.addIssue({ code: "custom", path: ["takeProfit"], message: "LONG target must be above entry" });
  }
});

export type AgentTradeProposal = z.infer<typeof TradeProposalSchema>;

export const tradeProposalJsonSchema = {
  type: "object",
  properties: {
    symbol: { type: "string" },
    action: { type: "string", enum: ["BUY", "WAIT", "CLOSE"] },
    confidence: { type: "number", minimum: 0, maximum: 100 },
    entry: { type: "number", minimum: 0 },
    stopLoss: { type: "number", minimum: 0 },
    takeProfit: { type: "number", minimum: 0 },
    riskReward: { type: "number", minimum: 0 },
    positionSize: { type: "number", minimum: 0 },
    thesis: { type: "string" },
    invalidation: { type: "string" },
    signalIds: { type: "array", items: { type: "string" } }
  },
  required: ["symbol", "action", "confidence", "entry", "stopLoss", "takeProfit", "riskReward", "positionSize", "thesis", "invalidation", "signalIds"],
  additionalProperties: false
} as const;
