import { CollaborativeFilter } from '../../src/ml/CollaborativeFilter';

describe('CollaborativeFilter', () => {
  let filter: CollaborativeFilter;

  beforeEach(() => {
    filter = new CollaborativeFilter();
  });

  it('should add interactions', () => {
    filter.addInteraction('user1', 'track1', 5);
    filter.addInteraction('user1', 'track2', 3);
    
    const recs = filter.getRecommendations('user1');
    expect(recs).toEqual([]);
  });

  it('should recommend based on similar users', () => {
    filter.addInteraction('user1', 'track1', 5);
    filter.addInteraction('user1', 'track2', 4);
    filter.addInteraction('user2', 'track1', 5);
    filter.addInteraction('user2', 'track3', 5);
    
    const recs = filter.getRecommendations('user1');
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].itemId).toBe('track3');
  });

  it('should handle empty history', () => {
    const recs = filter.getRecommendations('unknown');
    expect(recs).toEqual([]);
  });
});
