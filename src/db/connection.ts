import sql from 'mssql';
import { Config } from '../config';
import { logger } from '../util/logger';

/**
 * Opens a connection pool, retrying with a fixed backoff so the CLI is robust when
 * started immediately after the database container (before it accepts logins).
 */
export async function createPool(config: Config): Promise<sql.ConnectionPool> {
  const poolConfig: sql.config = {
    server: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
  };

  const maxAttempts = 30;
  for (let attempt = 1; ; attempt++) {
    try {
      const pool = new sql.ConnectionPool(poolConfig);
      await pool.connect();
      return pool;
    } catch (error) {
      if (attempt >= maxAttempts) {
        throw error;
      }
      logger.warn(`Database not ready (attempt ${attempt}/${maxAttempts}); retrying in 2s.`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}
