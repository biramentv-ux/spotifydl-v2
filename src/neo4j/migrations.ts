import { Neo4jClient } from './Neo4jClient';
import { logger } from '../core/Logger';

export const migrations = [
  {
    version: 1,
    name: 'Initial schema',
    up: async (client: Neo4jClient) => {
      await client.run(`
        CREATE CONSTRAINT track_id IF NOT EXISTS
        FOR (t:Track) REQUIRE t.id IS UNIQUE
      `);
      await client.run(`
        CREATE CONSTRAINT artist_id IF NOT EXISTS
        FOR (a:Artist) REQUIRE a.id IS UNIQUE
      `);
      await client.run(`
        CREATE CONSTRAINT user_id IF NOT EXISTS
        FOR (u:User) REQUIRE u.id IS UNIQUE
      `);
      logger.info('Migration v1 applied: Initial schema');
    }
  },
  {
    version: 2,
    name: 'Add indexes',
    up: async (client: Neo4jClient) => {
      await client.run(`CREATE INDEX track_name IF NOT EXISTS FOR (t:Track) ON (t.name)`);
      await client.run(`CREATE INDEX artist_name IF NOT EXISTS FOR (a:Artist) ON (a.name)`);
      logger.info('Migration v2 applied: Indexes');
    }
  }
];

export async function runMigrations(client: Neo4jClient): Promise<void> {
  for (const migration of migrations) {
    try {
      await migration.up(client);
    } catch (error) {
      logger.warn(`Migration ${migration.version} may already be applied`, { error });
    }
  }
}
