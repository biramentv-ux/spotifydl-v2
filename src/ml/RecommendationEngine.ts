import { logger } from '../core/Logger';
import { SpotifyAPI, AudioFeatures, SpotifyTrack } from '../core/SpotifyAPI';
import { Neo4jClient } from '../neo4j/Neo4jClient';

export interface Recommendation {
  track: SpotifyTrack;
  score: number;
  reason: string;
}

export class RecommendationEngine {
  private spotifyAPI: SpotifyAPI;
  private neo4j: Neo4jClient;
  private featureWeights = {
    danceability: 0.15,
    energy: 0.15,
    valence: 0.2,
    acousticness: 0.1,
    instrumentalness: 0.1,
    liveness: 0.1,
    speechiness: 0.1,
    tempo: 0.1
  };

  constructor(spotifyAPI: SpotifyAPI, neo4j: Neo4jClient) {
    this.spotifyAPI = spotifyAPI;
    this.neo4j = neo4j;
  }

  async getRecommendations(
    userId: string,
    seedTrackIds: string[],
    limit: number = 20
  ): Promise<Recommendation[]> {
    logger.info(`🎯 Generating recommendations for user: ${userId}`);

    try {
      // Get audio features for seed tracks
      const seedFeatures = await this.spotifyAPI.getAudioFeatures(seedTrackIds);
      const avgFeatures = this.calculateAverageFeatures(seedFeatures);

      // Get recommendations from Spotify API
      const spotifyRecs = await this.spotifyAPI.getRecommendations(seedTrackIds, limit * 2);

      // Get collaborative filtering recommendations from Neo4j
      const collaborativeRecs = await this.neo4j.getRecommendations(userId, limit);

      // Combine and score
      const recommendations = await this.scoreAndRank(
        spotifyRecs,
        collaborativeRecs,
        avgFeatures,
        userId
      );

      return recommendations.slice(0, limit);
    } catch (error) {
      logger.error('Recommendation engine failed', { userId, error });
      return [];
    }
  }

  private calculateAverageFeatures(features: AudioFeatures[]): Partial<AudioFeatures> {
    if (features.length === 0) return {};

    const keys: (keyof AudioFeatures)[] = [
      'danceability', 'energy', 'valence', 'acousticness',
      'instrumentalness', 'liveness', 'speechiness', 'tempo'
    ];

    const avg: any = {};
    for (const key of keys) {
      const values = features.map(f => f[key]).filter(v => v !== undefined);
      avg[key] = values.reduce((a, b) => a + b, 0) / values.length;
    }

    return avg;
  }

  private async scoreAndRank(
    spotifyRecs: SpotifyTrack[],
    collaborativeRecs: any[],
    targetFeatures: Partial<AudioFeatures>,
    userId: string
  ): Promise<Recommendation[]> {
    const scored: Recommendation[] = [];
    const seen = new Set<string>();

    // Score Spotify recommendations
    for (const track of spotifyRecs) {
      if (seen.has(track.id)) continue;
      seen.add(track.id);

      const features = await this.spotifyAPI.getAudioFeatures([track.id]);
      const featureScore = features.length > 0
        ? this.calculateFeatureSimilarity(features[0], targetFeatures)
        : 0.5;

      scored.push({
        track,
        score: 0.6 * featureScore + 0.4 * (track.popularity / 100),
        reason: 'Based on your listening patterns'
      });
    }

    // Boost collaborative recommendations
    for (const collab of collaborativeRecs) {
      const existing = scored.find(r => r.track.id === collab.id);
      if (existing) {
        existing.score += 0.2 * (collab.score / 10);
        existing.reason = 'Popular among similar users';
      }
    }

    return scored.sort((a, b) => b.score - a.score);
  }

  private calculateFeatureSimilarity(
    features: AudioFeatures,
    target: Partial<AudioFeatures>
  ): number {
    let score = 0;
    let totalWeight = 0;

    for (const [key, weight] of Object.entries(this.featureWeights)) {
      const featureKey = key as keyof AudioFeatures;
      if (target[featureKey] !== undefined) {
        const diff = Math.abs((features[featureKey] as number) - (target[featureKey] as number));
        score += weight * (1 - diff);
        totalWeight += weight;
      }
    }

    return totalWeight > 0 ? score / totalWeight : 0.5;
  }

  async getSimilarTracks(trackId: string, limit: number = 10): Promise<SpotifyTrack[]> {
    try {
      return await this.spotifyAPI.getRecommendations([trackId], limit);
    } catch (error) {
      logger.error('Failed to get similar tracks', { trackId, error });
      return [];
    }
  }
}
