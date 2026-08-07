import { logger } from '../core/Logger';
import { eventBus } from '../core/EventBus';

export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: BadgeRarity;
  condition: (stats: UserStats) => boolean;
}

export interface UserStats {
  totalDownloads: number;
  level: number;
  streakDays: number;
  uniqueArtists: number;
  playlistCount: number;
  cloudUploads: number;
  visualizerUses: number;
}

export interface UserBadge {
  badgeId: string;
  awardedAt: Date;
}

export class BadgeSystem {
  private badges: Badge[] = [];
  private userBadges: Map<string, UserBadge[]> = new Map();

  constructor() {
    this.initializeBadges();
  }

  private initializeBadges(): void {
    this.badges = [
      // Level badges
      { id: 'level_5', name: 'Rising Star', description: 'Reach level 5', icon: '⭐', rarity: 'common', condition: s => s.level >= 5 },
      { id: 'level_10', name: 'Mid Maestro', description: 'Reach level 10', icon: '🌟', rarity: 'rare', condition: s => s.level >= 10 },
      { id: 'level_15', name: 'High Virtuoso', description: 'Reach level 15', icon: '💫', rarity: 'epic', condition: s => s.level >= 15 },
      { id: 'level_20', name: 'Ultimate Audiophile', description: 'Reach level 20', icon: '👑', rarity: 'legendary', condition: s => s.level >= 20 },

      // Milestone badges
      { id: 'downloads_10', name: 'First Steps', description: 'Download 10 tracks', icon: '🎵', rarity: 'common', condition: s => s.totalDownloads >= 10 },
      { id: 'downloads_100', name: 'Century Club', description: 'Download 100 tracks', icon: '💿', rarity: 'rare', condition: s => s.totalDownloads >= 100 },
      { id: 'downloads_1000', name: 'Millennium', description: 'Download 1000 tracks', icon: '🏆', rarity: 'epic', condition: s => s.totalDownloads >= 1000 },
      { id: 'downloads_10000', name: 'Infinite Library', description: 'Download 10000 tracks', icon: '🌌', rarity: 'legendary', condition: s => s.totalDownloads >= 10000 },

      // Streak badges
      { id: 'streak_7', name: 'Week Warrior', description: '7-day streak', icon: '🔥', rarity: 'common', condition: s => s.streakDays >= 7 },
      { id: 'streak_30', name: 'Monthly Master', description: '30-day streak', icon: '📅', rarity: 'rare', condition: s => s.streakDays >= 30 },
      { id: 'streak_365', name: 'Yearly Yogi', description: '365-day streak', icon: '🗓️', rarity: 'legendary', condition: s => s.streakDays >= 365 },

      // Special badges
      { id: 'artist_50', name: 'Diverse Taste', description: 'Download from 50 unique artists', icon: '🎭', rarity: 'rare', condition: s => s.uniqueArtists >= 50 },
      { id: 'cloud_10', name: 'Cloud Walker', description: 'Upload 10 tracks to cloud', icon: '☁️', rarity: 'epic', condition: s => s.cloudUploads >= 10 },
      { id: 'visualizer_50', name: 'Visual Virtuoso', description: 'Create 50 visualizations', icon: '🎨', rarity: 'epic', condition: s => s.visualizerUses >= 50 },
      { id: 'playlist_10', name: 'Curator', description: 'Download 10 playlists', icon: '📋', rarity: 'rare', condition: s => s.playlistCount >= 10 },
      { id: 'first_download', name: 'Hello World', description: 'Complete your first download', icon: '🎉', rarity: 'common', condition: s => s.totalDownloads >= 1 }
    ];
  }

  checkAndAward(userId: string, stats: UserStats): string[] {
    const userBadges = this.getUserBadges(userId);
    const awarded: string[] = [];

    for (const badge of this.badges) {
      const alreadyHas = userBadges.some(ub => ub.badgeId === badge.id);
      if (!alreadyHas && badge.condition(stats)) {
        this.awardBadge(userId, badge);
        awarded.push(badge.id);
      }
    }

    return awarded;
  }

  private awardBadge(userId: string, badge: Badge): void {
    const userBadges = this.getUserBadges(userId);
    userBadges.push({
      badgeId: badge.id,
      awardedAt: new Date()
    });
    this.userBadges.set(userId, userBadges);

    eventBus.emit('badge:award', {
      userId,
      badgeId: badge.id,
      badgeName: badge.name,
      rarity: badge.rarity
    });

    logger.info(`🏅 Badge awarded: ${badge.name} (${badge.rarity}) to ${userId}`);
  }

  getUserBadges(userId: string): UserBadge[] {
    return this.userBadges.get(userId) || [];
  }

  getBadgeDetails(badgeId: string): Badge | undefined {
    return this.badges.find(b => b.id === badgeId);
  }

  getAllBadges(): Badge[] {
    return [...this.badges];
  }

  getUserBadgeDetails(userId: string): (Badge & { awardedAt: Date })[] {
    const userBadges = this.getUserBadges(userId);
    return userBadges
      .map(ub => {
        const badge = this.getBadgeDetails(ub.badgeId);
        return badge ? { ...badge, awardedAt: ub.awardedAt } : null;
      })
      .filter(Boolean) as (Badge & { awardedAt: Date })[];
  }

  getRarityColor(rarity: BadgeRarity): string {
    const colors: Record<BadgeRarity, string> = {
      common: '#9e9e9e',
      rare: '#4fc3f7',
      epic: '#ab47bc',
      legendary: '#ffd700'
    };
    return colors[rarity];
  }
}
