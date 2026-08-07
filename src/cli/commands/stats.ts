import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigManager } from '../../core/ConfigManager';
import { XPSystem } from '../../auth/XPSystem';
import { BadgeSystem } from '../../auth/BadgeSystem';

export const statsCommand = new Command('stats')
  .alias('stat')
  .description('Show user statistics, XP, and badges')
  .option('-u, --user <userId>', 'show stats for specific user')
  .option('--leaderboard', 'show global leaderboard')
  .option('--badges', 'show all available badges')
  .action(async (options) => {
    try {
      const config = new ConfigManager();
      await config.load();

      const xpSystem = new XPSystem(
        config.get('xp').baseThreshold,
        config.get('xp').multiplier,
        config.get('xp').dailyBonus
      );
      const badgeSystem = new BadgeSystem();

      if (options.badges) {
        console.log(chalk.bold('\n🏅 Available Badges\n'));
        const badges = badgeSystem.getAllBadges();
        
        badges.forEach(badge => {
          const colorFn = badge.rarity === 'common' ? chalk.gray :
                         badge.rarity === 'rare' ? chalk.cyan :
                         badge.rarity === 'epic' ? chalk.magenta : chalk.yellow;
          console.log(`  ${badge.icon} ${colorFn(badge.name)} ${chalk.gray(`(${badge.rarity})`)}`);
          console.log(`     ${chalk.gray(badge.description)}`);
        });
        console.log();
        return;
      }

      if (options.leaderboard) {
        console.log(chalk.bold('\n🏆 Leaderboard\n'));
        const leaderboard = xpSystem.getLeaderboard(10);
        
        leaderboard.forEach((user, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
          console.log(`  ${medal} ${chalk.cyan(user.userId)} - Level ${chalk.green(user.level)} (${user.currentXP} XP)`);
          console.log(`     ${chalk.gray(`${user.totalDownloads} downloads | ${user.streakDays} day streak`)}`);
        });
        console.log();
        return;
      }

      const userId = options.user || 'default-user';
      const stats = xpSystem.getUserStats(userId);
      const userBadges = badgeSystem.getUserBadgeDetails(userId);
      const nextLevel = xpSystem.getXPForNextLevel(userId);

      console.log(chalk.bold(`\n📊 User Stats: ${chalk.cyan(userId)}\n`));

      if (stats) {
        console.log(`${chalk.gray('Level:')} ${chalk.green(stats.level)} ${chalk.gray(`(${xpSystem.getLevels()[stats.level - 1]?.title || 'Unknown'})`)}`);
        console.log(`${chalk.gray('XP:')} ${chalk.yellow(stats.currentXP)} / ${chalk.yellow(nextLevel.needed)} ${chalk.gray(`(${nextLevel.remaining} to next level)`)}`);
        console.log(`${chalk.gray('Downloads:')} ${chalk.cyan(stats.totalDownloads)}`);
        console.log(`${chalk.gray('Streak:')} ${chalk.cyan(stats.streakDays)} days`);

        const progress = nextLevel.needed > 0 
          ? ((nextLevel.current / nextLevel.needed) * 20) 
          : 20;
        const bar = '█'.repeat(Math.floor(progress)) + '░'.repeat(20 - Math.floor(progress));
        console.log(`${chalk.gray('Progress:')} [${chalk.green(bar)}]`);
      } else {
        console.log(chalk.gray('No stats available. Start downloading to earn XP!'));
      }

      if (userBadges.length > 0) {
        console.log(chalk.bold('\n🏅 Badges:'));
        userBadges.forEach(badge => {
          const colorFn = badge.rarity === 'common' ? chalk.gray :
                         badge.rarity === 'rare' ? chalk.cyan :
                         badge.rarity === 'epic' ? chalk.magenta : chalk.yellow;
          console.log(`  ${badge.icon} ${colorFn(badge.name)} ${chalk.gray(`(${badge.rarity})`)}`);
        });
      }

      console.log();
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });
