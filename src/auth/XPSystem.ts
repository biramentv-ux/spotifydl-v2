import { logger } from '../core/Logger';
import { eventBus } from '../core/EventBus';

export interface XPLevel {
  level: number;
  threshold: number;
  title: string;
}

export interface UserXP {
  userId: string;
  currentXP: number;
  level: number;
  totalDownloads: number;
  streakDays: number;
  lastActive: Date;
}

export class XPSystem {
  private levels: XPLevel[] = [];
  private users: Map<string, UserXP> = new Map();
  private baseThreshold: number;
  private multiplier: number;
  private dailyBonus: number;

  constructor(baseThreshold: number = 100, multiplier: number = 1.5, dailyBonus: number = 50) {
    this.baseThreshold = baseThreshold;
    this.multiplier = multiplier;
    this.dailyBonus = dailyBonus;
    this.generateLevels();
  }

  private generateLevels(): void {
    for (let i = 1; i <= 20; i++) {
      this.levels.push({
        level: i,
        threshold: Math.floor(this.baseThreshold * Math.pow(this.multiplier, i - 1)),
        title: this.getLevelTitle(i)
      });
    }
  }

  private getLevelTitle(level: number): string {
    const titles = [
      'Novice Listener', 'Curious Ear', 'Music Explorer', 'Beat Seeker',
      'Rhythm Hunter', 'Melody Collector', 'Harmony Master', 'Sound Architect',
      'Audio Engineer', 'Music Curator', 'Playlist Wizard', 'Vinyl Virtuoso',
      'Studio Legend', 'Chart Topper', 'Platinum Ear', 'Diamond Collector',
      'Legendary DJ', 'Music Icon', 'Hall of Famer', 'Ultimate Audiophile'
    ];
    return titles[Math.min(level - 1, titles.length - 1)] || `Level ${level}`;
  }

  getOrCreateUser(userId: string): UserXP {
    if (!this.users.has(userId)) {
      this.users.set(userId, {
        userId,
        currentXP: 0,
        level: 1,
        totalDownloads: 0,
        streakDays: 0,
        lastActive: new Date()
      });
    }
    return this.users.get(userId)!;
  }

  addXP(userId: string, amount: number, reason: string = 'download'): void {
    const user = this.getOrCreateUser(userId);
    const previousLevel = user.level;
    
    // Check daily streak
    const now = new Date();
    const lastActive = new Date(user.lastActive);
    const dayDiff = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
    
    if (dayDiff === 1) {
      user.streakDays++;
      amount += Math.min(user.streakDays * 5, this.dailyBonus);
      logger.debug(`Streak bonus applied: ${user.streakDays} days`);
    } else if (dayDiff > 1) {
      user.streakDays = 0;
    }

    user.currentXP += amount;
    user.lastActive = now;

    if (reason === 'download') {
      user.totalDownloads++;
    }

    // Check level up
    const newLevel = this.calculateLevel(user.currentXP);
    const leveledUp = newLevel > previousLevel;
    
    if (leveledUp) {
      user.level = newLevel;
      logger.info(`🎉 Level up! ${userId} is now level ${newLevel} - ${this.getLevelTitle(newLevel)}`);
    }

    this.users.set(userId, user);

    eventBus.emit('xp:gain', {
      userId,
      points: amount,
      level: user.level,
      leveledUp
    });

    logger.debug(`Added ${amount} XP to ${userId} (${reason}). Total: ${user.currentXP}, Level: ${user.level}`);
  }

  calculateLevel(xp: number): number {
    for (let i = this.levels.length - 1; i >= 0; i--) {
      if (xp >= this.levels[i].threshold) {
        return this.levels[i].level;
      }
    }
    return 1;
  }

  getXPForNextLevel(userId: string): { current: number; needed: number; remaining: number } {
    const user = this.getOrCreateUser(userId);
    const nextLevel = this.levels.find(l => l.level === user.level + 1);
    if (!nextLevel) {
      return { current: user.currentXP, needed: user.currentXP, remaining: 0 };
    }
    return {
      current: user.currentXP,
      needed: nextLevel.threshold,
      remaining: nextLevel.threshold - user.currentXP
    };
  }

  getLeaderboard(limit: number = 10): UserXP[] {
    return Array.from(this.users.values())
      .sort((a, b) => b.currentXP - a.currentXP)
      .slice(0, limit);
  }

  getUserStats(userId: string): UserXP | null {
    return this.users.get(userId) || null;
  }

  getLevels(): XPLevel[] {
    return [...this.levels];
  }
}
