import { logger } from '../core/Logger';

export interface UserItemMatrix {
  [userId: string]: {
    [trackId: string]: number; // rating or interaction score
  };
}

export interface SimilarityScore {
  userId: string;
  similarity: number;
}

export class CollaborativeFilter {
  private matrix: UserItemMatrix = {};
  private userSimilarities: Map<string, SimilarityScore[]> = new Map();

  addInteraction(userId: string, trackId: string, score: number = 1): void {
    if (!this.matrix[userId]) {
      this.matrix[userId] = {};
    }
    this.matrix[userId][trackId] = (this.matrix[userId][trackId] || 0) + score;
    
    // Invalidate similarities cache for this user
    this.userSimilarities.delete(userId);
  }

  getRecommendations(userId: string, limit: number = 10): Array<{ trackId: string; predictedScore: number }> {
    if (!this.matrix[userId]) {
      return [];
    }

    const similarities = this.getSimilarUsers(userId);
    const userTracks = new Set(Object.keys(this.matrix[userId]));
    const recommendations: Map<string, number> = new Map();

    for (const { userId: similarUserId, similarity } of similarities.slice(0, 20)) {
      const similarUserTracks = this.matrix[similarUserId];
      
      for (const [trackId, score] of Object.entries(similarUserTracks)) {
        if (!userTracks.has(trackId)) {
          const current = recommendations.get(trackId) || 0;
          recommendations.set(trackId, current + similarity * score);
        }
      }
    }

    return Array.from(recommendations.entries())
      .map(([trackId, predictedScore]) => ({ trackId, predictedScore }))
      .sort((a, b) => b.predictedScore - a.predictedScore)
      .slice(0, limit);
  }

  private getSimilarUsers(userId: string): SimilarityScore[] {
    if (this.userSimilarities.has(userId)) {
      return this.userSimilarities.get(userId)!;
    }

    const userVector = this.matrix[userId];
    const similarities: SimilarityScore[] = [];

    for (const [otherUserId, otherVector] of Object.entries(this.matrix)) {
      if (otherUserId === userId) continue;

      const similarity = this.calculateCosineSimilarity(userVector, otherVector);
      if (similarity > 0) {
        similarities.push({ userId: otherUserId, similarity });
      }
    }

    const sorted = similarities.sort((a, b) => b.similarity - a.similarity);
    this.userSimilarities.set(userId, sorted);
    return sorted;
  }

  private calculateCosineSimilarity(
    vectorA: Record<string, number>,
    vectorB: Record<string, number>
  ): number {
    const allKeys = new Set([...Object.keys(vectorA), ...Object.keys(vectorB)]);
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (const key of allKeys) {
      const a = vectorA[key] || 0;
      const b = vectorB[key] || 0;
      dotProduct += a * b;
      normA += a * a;
      normB += b * b;
    }

    return normA > 0 && normB > 0 ? dotProduct / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
  }

  getUserStats(userId: string): { totalInteractions: number; uniqueTracks: number } {
    const userData = this.matrix[userId] || {};
    return {
      totalInteractions: Object.values(userData).reduce((a, b) => a + b, 0),
      uniqueTracks: Object.keys(userData).length
    };
  }

  exportMatrix(): UserItemMatrix {
    return JSON.parse(JSON.stringify(this.matrix));
  }

  importMatrix(data: UserItemMatrix): void {
    this.matrix = data;
    this.userSimilarities.clear();
  }
}
