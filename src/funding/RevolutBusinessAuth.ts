import "server-only";
import { createSign } from "node:crypto";

const ASSERTION_TYPE = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function normalizePem(value: string) {
  return value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
}

export function createRevolutClientAssertion(input: {
  issuerDomain: string;
  clientId: string;
  privateKeyPem: string;
  expiresAt?: Date;
}) {
  const issuer = input.issuerDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!issuer) throw new Error("REVOLUT_ISSUER_DOMAIN_REQUIRED");
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: issuer,
    sub: input.clientId,
    aud: "https://revolut.com",
    exp: Math.floor((input.expiresAt ?? new Date(Date.now() + 60 * 60_000)).getTime() / 1000)
  }));
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(normalizePem(input.privateKeyPem));
  return `${unsigned}.${base64Url(signature)}`;
}

export class RevolutBusinessTokenProvider {
  private cached?: { token: string; expiresAt: number };

  constructor(private readonly config: {
    baseUrl: string;
    clientId: string;
    issuerDomain: string;
    privateKeyPem: string;
    refreshToken: string;
  }) {}

  async getAccessToken() {
    const now = Date.now();
    if (this.cached && this.cached.expiresAt - now > 120_000) return this.cached.token;

    const assertion = createRevolutClientAssertion({
      issuerDomain: this.config.issuerDomain,
      clientId: this.config.clientId,
      privateKeyPem: this.config.privateKeyPem
    });
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: this.config.refreshToken,
      client_assertion_type: ASSERTION_TYPE,
      client_assertion: assertion
    });
    const response = await fetch(`${this.config.baseUrl}/auth/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`REVOLUT_AUTH_HTTP_${response.status}`);
    const token = await response.json() as { access_token?: string; expires_in?: number };
    if (!token.access_token) throw new Error("REVOLUT_ACCESS_TOKEN_MISSING");
    const expiresIn = Number(token.expires_in ?? 2399);
    this.cached = { token: token.access_token, expiresAt: now + Math.max(60, expiresIn) * 1000 };
    return token.access_token;
  }
}
