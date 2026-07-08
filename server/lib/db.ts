import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@/app/db/schema";
import { getDatabaseEnv } from "./env";
import { logger } from "./logger";

const { databaseUrl } = getDatabaseEnv();

const pool = new pg.Pool({
  connectionString: databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  keepAlive: true,
  allowExitOnIdle: false,
});

pool.on("error", (err) => {
  logger.error("DB pool idle client error", { err: String(err) });
});

export const db = drizzle(pool, { schema });
