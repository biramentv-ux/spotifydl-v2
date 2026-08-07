import { BadgeSystem } from '../../src/auth/BadgeSystem';

describe('BadgeSystem', () => {
  let badgeSystem: BadgeSystem;

  beforeEach(() => {
    badgeSystem = new BadgeSystem();
  });

  it('should initialize with default badges', () => {
    const badges = badgeSystem.getAllBadges();
    expect(badges.length).toBeGreaterThan(0);
    expect(badges.some(b => b.id === 'first_download')).toBe(true);
  });

  it('should award badge when condition met', () => {
    badgeSystem.updateStats('user1', { totalDownloads: 1 });
    const badges = badgeSystem.getUserBadges('user1');
    expect(badges.some(b => b.badgeId === 'first_download')).toBe(true);
  });

  it('should track user stats', () => {
    badgeSystem.updateStats('user1', { totalDownloads: 10, level: 5 });
    const stats = badgeSystem.getStats('user1');
    expect(stats.totalDownloads).toBe(10);
    expect(stats.level).toBe(5);
  });

  it('should return badge progress', () => {
    badgeSystem.updateStats('user1', { totalDownloads: 1 });
    const progress = badgeSystem.getBadgeProgress('user1');
    expect(progress.earned.length).toBeGreaterThan(0);
    expect(progress.locked.length).toBeGreaterThan(0);
  });
});
