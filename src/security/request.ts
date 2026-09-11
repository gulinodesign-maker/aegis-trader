import "server-only";

export function assertSameOriginMutation(request: Request) {
  const requestedWith = request.headers.get("x-requested-with");
  if (requestedWith !== "trading-pwa") throw new Error("CSRF_HEADER_REQUIRED");
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    const originHost = new URL(origin).host;
    if (originHost !== host) throw new Error("CROSS_ORIGIN_MUTATION_BLOCKED");
  }
}

export function assertCronAuth(request: Request, secret?: string) {
  if (!secret) throw new Error("CRON_SECRET_NOT_CONFIGURED");
  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${secret}`) throw new Error("UNAUTHORIZED_CRON");
}
