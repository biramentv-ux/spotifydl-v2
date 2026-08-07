import { logger } from '../core/Logger';
import { AudioFeatures } from '../core/SpotifyAPI';

export interface TrackFeatures {
  id: string;
  name: string;
  normalized: Record<string, number>;
  genre: string[];
  era: string;
  mood: string;
}

export class FeatureExtractor {
  private genreKeywords: Record<string, string[]> = {
    'electronic': ['electronic', 'edm', 'house', 'techno', 'dubstep', 'synth'],
    'rock': ['rock', 'alternative', 'indie', 'punk', 'metal'],
    'pop': ['pop', 'dance-pop', 'synth-pop'],
    'hip-hop': ['hip-hop', 'rap', 'trap', 'r&b'],
    'jazz': ['jazz', 'swing', 'bossa', 'fusion'],
    'classical': ['classical', 'orchestral', 'symphony', 'opera'],
    'folk': ['folk', 'acoustic', 'country', 'bluegrass'],
    'reggae': ['reggae', 'ska', 'dub']
  };

  extractFeatures(trackId: string, name: string, features: AudioFeatures, genres: string[]): TrackFeatures {
    const normalized = this.normalizeFeatures(features);
    const era = this.detectEra(features);
    const mood = this.detectMood(features);

    return {
      id: trackId,
      name,
      normalized,
      genre: this.classifyGenre(genres),
      era,
      mood
    };
  }

  private normalizeFeatures(features: AudioFeatures): Record<string, number> {
    return {
      danceability: features.danceability,
      energy: features.energy,
      valence: features.valence,
      acousticness: features.acousticness,
      instrumentalness: features.instrumentalness,
      liveness: features.liveness,
      speechiness: features.speechiness,
      tempo: this.normalizeTempo(features.tempo)
    };
  }

  private normalizeTempo(tempo: number): number {
    // Normalize tempo to 0-1 range (typical range: 60-200 BPM)
    return Math.min(Math.max((tempo - 60) / 140, 0), 1);
  }

  private detectEra(features: AudioFeatures): string {
    const { acousticness, instrumentalness, tempo } = features;
    
    if (acousticness > 0.7 && instrumentalness > 0.5) return 'classical';
    if (tempo > 150 && features.energy > 0.8) return 'modern';
    if (features.valence > 0.7 && tempo > 120) return 'golden-age';
    if (acousticness > 0.5) return 'acoustic-era';
    return 'contemporary';
  }

  private detectMood(features: AudioFeatures): string {
    const { valence, energy, danceability } = features;
    
    if (valence > 0.7 && energy > 0.7) return 'happy';
    if (valence > 0.6 && energy < 0.4) return 'calm';
    if (valence < 0.3 && energy < 0.4) return 'sad';
    if (valence < 0.4 && energy > 0.7) return 'angry';
    if (danceability > 0.7) return 'party';
    if (energy > 0.8) return 'energetic';
    if (valence > 0.5) return 'positive';
    return 'neutral';
  }

  private classifyGenre(genres: string[]): string[] {
    const matched: string[] = [];
    
    for (const [category, keywords] of Object.entries(this.genreKeywords)) {
      for (const genre of genres) {
        const lowerGenre = genre.toLowerCase();
        if (keywords.some(kw => lowerGenre.includes(kw))) {
          matched.push(category);
          break;
        }
      }
    }
    
    return matched.length > 0 ? matched : ['unknown'];
  }

  calculateSimilarity(trackA: TrackFeatures, trackB: TrackFeatures): number {
    const keys = Object.keys(trackA.normalized);
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (const key of keys) {
      const a = trackA.normalized[key] || 0;
      const b = trackB.normalized[key] || 0;
      dotProduct += a * b;
      normA += a * a;
      normB += b * b;
    }

    const genreOverlap = trackA.genre.filter(g => trackB.genre.includes(g)).length;
    const genreBonus = genreOverlap > 0 ? 0.1 * genreOverlap : 0;

    const cosine = normA > 0 && normB > 0 ? dotProduct / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
    return Math.min(cosine + genreBonus, 1);
  }
}
