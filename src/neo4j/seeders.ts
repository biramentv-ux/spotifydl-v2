import { Neo4jClient } from './Neo4jClient';
import { logger } from '../core/Logger';

export async function seedDatabase(client: Neo4jClient): Promise<void> {
  logger.info('Seeding Neo4j database...');
  
  // Seed sample relationships
  await client.run(`
    MERGE (u:User {id: 'system', displayName: 'System', level: 1})
  `);
  
  logger.info('Neo4j database seeded');
}
