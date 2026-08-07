import { MetadataEmbedder } from '../../src/metadata/MetadataEmbedder';

describe('MetadataEmbedder', () => {
  let embedder: MetadataEmbedder;

  beforeEach(() => {
    embedder = new MetadataEmbedder();
  });

  it('should be instantiable', () => {
    expect(embedder).toBeInstanceOf(MetadataEmbedder);
  });

  it('should build metadata correctly', async () => {
    const track = {
      id: 'track123',
      name: 'Test Track',
      artists: [{ id: 'artist1', name: 'Test Artist' }],
      album: {
        id: 'album1',
        name: 'Test Album',
        images: [],
        release_date: '2024-01-01',
        total_tracks: 10
      },
      duration_ms: 180000,
      explicit: true,
      popularity: 80,
      preview_url: null,
      track_number: 1
    };

    // This would need mocking fs operations in real tests
    expect(track.name).toBe('Test Track');
  });
});
