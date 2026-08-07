import { XPSystem } from '../../src/auth/XPSystem';
import { ConfigManager } from '../../src/core/ConfigManager';

describe('XPSystem', () => {
  let xpSystem: XPSystem;
  let config: ConfigManager;

  beforeEach(() => {
    config = new ConfigManager();
    xpSystem = new XPSystem(config);
  });

  it('should create default profile for new user', () => {
    const profile = xpSystem.getProfile('user1');
    expect(profile.userId).toBe('user1');
    expect(profile.level).toBe(1);
    expect(profile.totalXP).toBe(0);
  });

  it('should add XP and track progress', () => {
    const result = xpSystem.addXP('user1', { action: 'download' });
    expect(result.pointsGained).toBe(10);
    expect(result.leveledUp).toBe(false);
    expect(result.newLevel).toBe(1);
  });

  it('should level up when threshold reached', () => {
    for (let i = 0; i < 15; i++) {
      xpSystem.addXP('user1', { action: 'premium_track', metadata: { isPremium: true } });
    }
    const profile = xpSystem.getProfile('user1');
    expect(profile.level).toBeGreaterThan(1);
  });

  it('should return leaderboard', () => {
    xpSystem.addXP('user1', { action: 'download' });
    xpSystem.addXP('user2', { action: 'download' });
    xpSystem.addXP('user2', { action: 'download' });
    
    const leaderboard = xpSystem.getLeaderboard(10);
    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].userId).toBe('user2');
  });
});
