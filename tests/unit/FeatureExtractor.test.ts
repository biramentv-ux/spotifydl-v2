import { FeatureExtractor } from '../../src/ml/FeatureExtractor';
import { AudioFeatures } from '../../src/core/SpotifyAPI';

describe('FeatureExtractor', () => {
  let extractor: FeatureExtractor;

  beforeEach(() => {
    extractor = new FeatureExtractor();
  });

  it('should extract feature vector', () => {
    const features: AudioFeatures = {
      danceability: 0.8,
      energy: 0.7,
      key: 5,
      loudness: -5,
      mode: 1,
      speechiness: 0.1,
      acousticness: 0.2,
      instrumentalness: 0,
      liveness: 0.3,
      valence: 0.9,
      tempo: 120
    };

    const vector = extractor.extractVector(features);
    expect(vector.length).toBe(8);
    expect(vector[0]).toBe(0.8);
    expect(vector[6]).toBe(0.9);
  });

  it('should calculate cosine similarity', () => {
    const a = [1, 0, 0];
    const b = [1, 0, 0];
    expect(extractor.cosineSimilarity(a, b)).toBeCloseTo(1);

    const c = [0, 1, 0];
    expect(extractor.cosineSimilarity(a, c)).toBeCloseTo(0);
  });

  it('should average features', () => {
    const features: AudioFeatures[] = [
      { danceability: 0.5, energy: 0.5, key: 0, loudness: 0, mode: 0, speechiness: 0.5, acousticness: 0.5, instrumentalness: 0, liveness: 0.5, valence: 0.5, tempo: 100 },
      { danceability: 0.7, energy: 0.7, key: 0, loudness: 0, mode: 0, speechiness: 0.7, acousticness: 0.7, instrumentalness: 0, liveness: 0.7, valence: 0.7, tempo: 140 }
    ];

    const avg = extractor.averageFeatures(features);
    expect(avg[0]).toBeCloseTo(0.6);
  });
});
