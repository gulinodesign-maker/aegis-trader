import "server-only";
import type { TradeProposal } from "../domain/types";
import { TradeProposalSchema, tradeProposalJsonSchema } from "./schema";
import { agentToolDefinitions, executeAgentTool, type AgentToolContext } from "./tools";

const SYSTEM_INSTRUCTIONS = `You are a trading analysis agent inside a safety-constrained application.
You are NOT an oracle and must not promise returns.
You may output only BUY, WAIT, or CLOSE proposals.
You must use tools for any market price, candle, signal, portfolio, sizing, or backtest fact. Never invent a quote.
The quantitative Signal Engine calculates indicators and signal score. Do not overwrite its market prices with guessed numbers.
You never execute broker orders. You have no broker execution tool.
The deterministic Risk Engine is authoritative and runs after your proposal. Never claim that you can bypass, weaken, or override it.
For BUY, stopLoss is mandatory, must be below entry, and takeProfit must be above entry. Prefer WAIT when data is stale, incomplete, market closed, spread/risk cannot be verified, or signal quality is weak.
No leverage, margin, options, CFD, shorts, or short selling in V1.
Backtest evidence must include costs/slippage limitations; never promote a strategy from win rate alone.
Keep thesis and invalidation concise and data-grounded.`;

type FunctionCall = { type: "function_call"; call_id: string; name: string; arguments: string };
type OutputItem = FunctionCall | { type: string; [key: string]: unknown };
type ResponseEnvelope = { id: string; status?: string; output: OutputItem[]; error?: unknown };

export interface AgentRunOptions {
  apiKey: string;
  model: string;
  userPrompt: string;
  context: AgentToolContext;
  onEvent?: (event: { type: string; payload: unknown }) => Promise<void> | void;
}

export async function runTradingAgent(options: AgentRunOptions): Promise<TradeProposal> {
  const input: unknown[] = [{ role: "user", content: options.userPrompt }];
  for (let iteration = 0; iteration < 8; iteration++) {
    const response = await createResponse({ apiKey: options.apiKey, model: options.model, input, instructions: SYSTEM_INSTRUCTIONS });
    await options.onEvent?.({ type: "model_response", payload: { responseId: response.id, iteration, outputTypes: response.output.map(x => x.type) } });
    input.push(...response.output);
    const calls = response.output.filter((item): item is FunctionCall => item.type === "function_call");
    if (calls.length) {
      for (const call of calls) {
        const args = safeJsonObject(call.arguments);
        await options.onEvent?.({ type: "tool_call", payload: { name: call.name, args } });
        let result: unknown;
        try { result = await executeAgentTool(call.name, args, options.context); }
        catch (error) { result = { error: error instanceof Error ? error.message : "TOOL_ERROR" }; }
        await options.onEvent?.({ type: "tool_result", payload: { name: call.name, result } });
        input.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result) });
      }
      continue;
    }

    const text = extractOutputText(response);
    if (!text) throw new Error("Agent returned no structured output");
    const parsed = TradeProposalSchema.parse(JSON.parse(text));
    await options.onEvent?.({ type: "proposal", payload: parsed });
    return { ...parsed, id: `agent-${response.id}`, createdAt: new Date().toISOString() };
  }
  throw new Error("Agent tool loop exceeded safe iteration limit");
}

async function createResponse(args: { apiKey: string; model: string; input: unknown[]; instructions: string }): Promise<ResponseEnvelope> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${args.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: args.model,
      instructions: args.instructions,
      input: args.input,
      tools: agentToolDefinitions,
      text: { format: { type: "json_schema", name: "trade_proposal", strict: true, schema: tradeProposalJsonSchema } },
      max_output_tokens: 1800
    }),
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`OPENAI_HTTP_${response.status}`);
  }
  return response.json() as Promise<ResponseEnvelope>;
}

function safeJsonObject(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid tool arguments");
  return parsed as Record<string, unknown>;
}

function extractOutputText(response: ResponseEnvelope) {
  for (const item of response.output) {
    if (item.type !== "message") continue;
    const content = item.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (part && typeof part === "object" && (part as { type?: string }).type === "output_text" && typeof (part as { text?: unknown }).text === "string") return (part as { text: string }).text;
    }
  }
  return null;
}
