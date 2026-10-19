import pg from "pg";

let pool;
export function getPool() {
  if (pool) return pool;
  if (process.env.MERCH_DATABASE_DRIVER !== "postgres")
    throw new Error("postgres_driver_required");
  const value = process.env.MERCH_DATABASE_URL?.trim();
  if (!value) throw new Error("merch_database_url_required");
  const url = new URL(value);
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("postgres_url_invalid");
  // Verify the server certificate explicitly, including on future pg versions.
  url.searchParams.set("sslmode", "verify-full");
  pool = new pg.Pool({
    connectionString: url.href,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: true,
    types: { getTypeParser(oid, format) {
      if (format === 'text' && [20, 1700].includes(oid)) return value => {
        const number = Number(value);
        if (!Number.isSafeInteger(number)) throw new Error('postgres_integer_out_of_range');
        return number;
      };
      return pg.types.getTypeParser(oid, format);
    } },
  });
  return pool;
}

export async function transaction(operation, database = getPool()) {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout='10s'");
    await client.query("SET LOCAL statement_timeout='30s'");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function insertRow(client, table, row) {
  const columns = Object.keys(row);
  if (table.split(".").length !== 2) throw new Error("qualified_table_required");
  if (
    ![...table.split("."), ...columns].every((name) =>
      /^[a-z_][a-z0-9_]*$/.test(name),
    )
  )
    throw new Error("invalid_sql_identifier");
  const result = await client.query(
    `INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map((_, i) => "$" + (i + 1)).join(",")}) RETURNING *`,
    Object.values(row),
  );
  return result.rows[0];
}

// Schema names are an internal repository dependency, never request input.
// Every query uses these qualified names; pooled session search_path is irrelevant.
export function sqlTables(schema = "public") {
  if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error("invalid_sql_schema");
  const names = [
    "renaiss_identity_sessions",
    "renaiss_oauth_challenges",
    "shipping_claims",
    "shipping_profiles",
    "vip_ticket_claims",
    "merch_product_entitlements",
    "merch_access_checks",
    "hub_preferences",
    "surf_store_claims",
  ];
  return Object.fromEntries(names.map((name) => [name, `${schema}.${name}`]));
}
