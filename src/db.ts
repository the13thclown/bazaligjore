import pg from "pg";

export const pool = new pg.Pool({
  host: process.env.PGHOST ?? "localhost",
  port: Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE ?? "postgres",
  user: process.env.PGUSER ?? "postgres",
  password: process.env.PGPASSWORD ?? "",
  max: 10,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
});

// Defense in depth: this server must never write, even if the role could.
pool.on("connect", (client) => {
  client.query(
    "SET default_transaction_read_only = on; SET statement_timeout = '15s'"
  );
});

export async function q<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}
