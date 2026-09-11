import "server-only";
import type { FundingProvider } from "./FundingProvider";
import { SepaFundingProvider } from "./SepaFundingProvider";
import { RevolutFundingProvider } from "./RevolutFundingProvider";
import { RevolutBusinessTokenProvider } from "./RevolutBusinessAuth";
import { getEnv } from "../config/env";

let cached: FundingProvider | undefined;

export function getFundingProvider(): FundingProvider {
  if (cached) return cached;
  const env = getEnv();
  if (env.FUNDING_PROVIDER !== "revolut-business") return (cached = new SepaFundingProvider());
  if (!env.REVOLUT_BUSINESS_API_ENABLED) throw new Error("REVOLUT_BUSINESS_API_DISABLED");
  if (!env.REVOLUT_CLIENT_ID || !env.REVOLUT_REFRESH_TOKEN || !env.REVOLUT_PRIVATE_KEY_PEM || !env.REVOLUT_ISSUER_DOMAIN) {
    throw new Error("REVOLUT_BUSINESS_AUTH_CONFIGURATION_INCOMPLETE");
  }
  const tokenProvider = new RevolutBusinessTokenProvider({
    baseUrl: env.REVOLUT_BUSINESS_BASE_URL,
    clientId: env.REVOLUT_CLIENT_ID,
    refreshToken: env.REVOLUT_REFRESH_TOKEN,
    privateKeyPem: env.REVOLUT_PRIVATE_KEY_PEM,
    issuerDomain: env.REVOLUT_ISSUER_DOMAIN
  });
  cached = new RevolutFundingProvider({ enabled: true, baseUrl: env.REVOLUT_BUSINESS_BASE_URL, getAccessToken: () => tokenProvider.getAccessToken() });
  return cached;
}
