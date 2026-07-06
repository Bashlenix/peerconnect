// @fastify/rate-limit throws its errorResponseBuilder's return value directly
// (see its source: `throw params.errorResponseBuilder(req, respCtx)`) rather
// than calling reply.send() itself or throwing a proper Error instance. That
// plain object reaches our custom setErrorHandler in app.ts, which otherwise
// has no way to tell it apart from any other thrown value and would let it
// fall through to a bare 500.

export function isRateLimitError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "rate_limited"
  );
}
