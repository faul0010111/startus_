import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { Pool, type QueryResultRow } from "pg";
import { loadConfig } from "@stratus/config";

@Injectable()
export class Database implements OnModuleDestroy {
  readonly pool = new Pool({
    connectionString: loadConfig("stratus-api", 4000).POSTGRES_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
  });

  async query<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.pool.query<T>(sql, params);
    return result.rows;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
