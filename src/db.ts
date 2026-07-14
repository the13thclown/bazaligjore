import pg from "pg";

const baseConfig: pg.PoolConfig = {
  host: process.env.PGHOST ?? "localhost",
  port: Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE ?? "postgres",
  user: process.env.PGUSER ?? "postgres",
  password: process.env.PGPASSWORD ?? "",
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
};

// Defense in depth: this server must never write, even if the role could.
const readOnlyOnConnect = (client: pg.PoolClient) => {
  client.query(
    "SET default_transaction_read_only = on; SET statement_timeout = '15s'"
  );
};

// Main pool for tool queries.
export const pool = new pg.Pool({ ...baseConfig, max: 10 });
pool.on("connect", readOnlyOnConnect);

// Dedicated tiny pool for the health check, so a saturated query pool
// (e.g. under a burst of slow query_sql calls) can never make /healthz fail
// and trigger a platform restart loop.
export const healthPool = new pg.Pool({ ...baseConfig, max: 2 });
healthPool.on("connect", (client) => {
  client.query("SET statement_timeout = '3s'");
});

export async function q<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

// Run one read-only statement with a tighter per-query timeout than the
// pool default. SET LOCAL auto-resets when the (read-only) transaction ends,
// so it never leaks the shorter timeout back onto the pooled connection.
export async function qSandboxed<T = Record<string, unknown>>(
  text: string,
  timeoutMs: number
): Promise<T[]> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL statement_timeout = ${Math.trunc(timeoutMs)}`);
    const res = await client.query(text);
    await client.query("COMMIT");
    return res.rows as T[];
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}
