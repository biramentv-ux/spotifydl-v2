import neo4j, { Driver, Session, Record as Neo4jRecord } from 'neo4j-driver';
import { logger } from '../core/Logger';
import { ConfigManager } from '../core/ConfigManager';

export class Neo4jClient {
  private driver: Driver;
  private connected = false;

  constructor(config: ConfigManager) {
    const neo4jConfig = config.get('neo4j');
    this.driver = neo4j.driver(
      neo4jConfig.uri,
      neo4j.auth.basic(neo4jConfig.user, neo4jConfig.password)
    );
  }

  async connect(): Promise<void> {
    try {
      await this.driver.verifyConnectivity();
      this.connected = true;
      logger.info('🔗 Neo4j connected');
    } catch (error) {
      logger.error('Neo4j connection failed', { error });
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.driver.close();
    this.connected = false;
    logger.info('Neo4j disconnected');
  }

  async run(query: string, parameters: Record<string, any> = {}): Promise<Neo4jRecord[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(query, parameters);
      return result.records;
    } finally {
      await session.close();
    }
  }

  async createTrackNode(track: any): Promise<void> {
    const query = `
      MERGE (t:Track {id: $id})
      SET t.name = $name,
          t.duration = $duration,
          t.popularity = $popularity,
          t.explicit = $explicit,
          t.updatedAt = datetime()
      WITH t
      UNWIND $artists as artist
      MERGE (a:Artist {id: artist.id})
      SET a.name = artist.name
      MERGE (t)-[:BY]->(a)
      WITH t
      MERGE (al:Album {id: $album.id})
      SET al.name = $album.name,
          al.releaseDate = $album.releaseDate
      MERGE (t)-[:ON]->(al)
    `;

    await this.run(query, {
      id: track.id,
      name: track.name,
      duration: track.duration_ms,
      popularity: track.popularity,
      explicit: track.explicit,
      artists: track.artists.map((a: any) => ({ id: a.id, name: a.name })),
      album: {
        id: track.album.id,
        name: track.album.name,
        releaseDate: track.album.release_date
      }
    });
  }

  async createUserNode(userId: string, displayName: string): Promise<void> {
    const query = `
      MERGE (u:User {id: $userId})
      SET u.displayName = $displayName,
          u.createdAt = datetime()
    `;
    await this.run(query, { userId, displayName });
  }

  async recordDownload(userId: string, trackId: string): Promise<void> {
    const query = `
      MATCH (u:User {id: $userId})
      MATCH (t:Track {id: $trackId})
      MERGE (u)-[d:DOWNLOADED {trackId: $trackId}]->(t)
      SET d.downloadedAt = datetime(),
          d.count = coalesce(d.count, 0) + 1
    `;
    await this.run(query, { userId, trackId });
  }

  async getRecommendations(userId: string, limit: number = 10): Promise<any[]> {
    const query = `
      MATCH (u:User {id: $userId})-[:DOWNLOADED]->(t:Track)-[:BY]->(a:Artist)
      WITH u, collect(DISTINCT a) as likedArtists
      UNWIND likedArtists as artist
      MATCH (artist)<-[:BY]-(rec:Track)
      WHERE NOT (u)-[:DOWNLOADED]->(rec)
      RETURN rec.id as id, rec.name as name, count(*) as score
      ORDER BY score DESC
      LIMIT $limit
    `;

    const records = await this.run(query, { userId, limit });
    return records.map(r => ({
      id: r.get('id'),
      name: r.get('name'),
      score: r.get('score').toNumber()
    }));
  }

  async getUserStats(userId: string): Promise<any> {
    const query = `
      MATCH (u:User {id: $userId})-[:DOWNLOADED]->(t:Track)
      RETURN count(DISTINCT t) as totalDownloads,
             count(DISTINCT t.id) as uniqueTracks,
             avg(t.popularity) as avgPopularity
    `;

    const records = await this.run(query, { userId });
    const record = records[0];
    return {
      totalDownloads: record.get('totalDownloads').toNumber(),
      uniqueTracks: record.get('uniqueTracks').toNumber(),
      avgPopularity: record.get('avgPopularity')
    };
  }

  isConnected(): boolean {
    return this.connected;
  }
}
