// Distinguishes "the database is unreachable right now" from "your query was
// bad". Used by the app's error handler to turn transient connection failures
// into a clean 503 instead of leaking a raw Prisma stack trace — which is what
// users saw on login/signup while the DB container was still starting up after
// a Codespace resume.

// Codes that mean the server could not be reached / is not accepting
// connections, spanning three layers: the Node socket layer, Prisma's engine
// error codes, and Postgres connection-class SQLSTATEs.
const CONNECTION_ERROR_CODES = new Set<string>([
  // Node/libpq socket-level errors
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "EPIPE",
  // Prisma "can't reach database server" family
  "P1001", // Can't reach database server
  "P1002", // Database server was reached but timed out
  "P1008", // Operations timed out
  "P1017", // Server has closed the connection
  // Postgres connection-class SQLSTATEs
  "08000", // connection_exception
  "08001", // sqlclient_unable_to_establish_sqlconnection
  "08004", // sqlserver_rejected_establishment_of_sqlconnection
  "08006", // connection_failure
  "57P01", // admin_shutdown
  "57P03", // cannot_connect_now
]);

function stringCodeOf(value: unknown): string | undefined {
  if (typeof value === "object" && value !== null && "code" in value) {
    const code = (value as { code: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

function nameOf(value: unknown): string | undefined {
  if (typeof value === "object" && value !== null && "name" in value) {
    const name = (value as { name: unknown }).name;
    return typeof name === "string" ? name : undefined;
  }
  return undefined;
}

/**
 * True when `err` (or any error in its `cause` chain) indicates the database is
 * unreachable, rather than a logical/query error. The chain is walked because
 * the underlying pg driver error is frequently wrapped by Prisma.
 */
export function isDatabaseUnavailableError(err: unknown): boolean {
  let current: unknown = err;

  for (let depth = 0; current != null && depth < 5; depth++) {
    if (nameOf(current) === "PrismaClientInitializationError") return true;

    const code = stringCodeOf(current);
    if (code && CONNECTION_ERROR_CODES.has(code)) return true;

    current =
      typeof current === "object" && current !== null
        ? (current as { cause?: unknown }).cause
        : undefined;
  }

  return false;
}
