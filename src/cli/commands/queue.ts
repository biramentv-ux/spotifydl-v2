import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigManager } from '../../core/ConfigManager';
import { DownloadManager } from '../../download/DownloadManager';
import { HybridEngine } from '../../download/engines/HybridEngine';

export const queueCommand = new Command('queue')
  .alias('q')
  .description('Show download queue and statistics')
  .option('-c, --clear', 'clear completed downloads')
  .option('--cancel <taskId>', 'cancel a specific download')
  .action(async (options) => {
    try {
      const config = new ConfigManager();
      await config.load();

      const engine = new HybridEngine();
      const downloadManager = new DownloadManager(config, engine);

      if (options.clear) {
        downloadManager.clearCompleted();
        console.log(chalk.green('✅ Completed downloads cleared'));
        return;
      }

      if (options.cancel) {
        const cancelled = downloadManager.cancelDownload(options.cancel);
        if (cancelled) {
          console.log(chalk.green(`✅ Cancelled task: ${options.cancel}`));
        } else {
          console.log(chalk.red(`❌ Task not found: ${options.cancel}`));
        }
        return;
      }

      const stats = downloadManager.getStats();
      const queue = downloadManager.getQueue();
      const active = downloadManager.getActive();
      const completed = downloadManager.getCompleted();

      console.log(chalk.bold('\n📊 Download Statistics\n'));
      console.log(`${chalk.gray('Queued:')}   ${chalk.yellow(stats.queued)}`);
      console.log(`${chalk.gray('Active:')}   ${chalk.cyan(stats.active)}`);
      console.log(`${chalk.gray('Completed:')} ${chalk.green(stats.completed)}`);
      console.log(`${chalk.gray('Failed:')}   ${chalk.red(stats.failed)}`);

      if (active.length > 0) {
        console.log(chalk.bold('\n▶️ Active Downloads:\n'));
        active.forEach(task => {
          const bar = '█'.repeat(Math.floor(task.progress / 10)) + '░'.repeat(10 - Math.floor(task.progress / 10));
          console.log(`  ${chalk.cyan(task.track.name)} [${bar}] ${task.progress.toFixed(1)}%`);
          console.log(`     ${chalk.gray('Speed:')} ${(task.speed / 1024).toFixed(1)} KB/s | ${chalk.gray('Task ID:')} ${task.id}`);
        });
      }

      if (queue.length > 0) {
        console.log(chalk.bold('\n⏳ Queue:\n'));
        queue.slice(0, 10).forEach((task, i) => {
          console.log(`  ${chalk.gray(`${i + 1}.`)} ${task.track.name} - ${task.track.artists.map(a => a.name).join(', ')}`);
        });
        if (queue.length > 10) {
          console.log(chalk.gray(`  ... and ${queue.length - 10} more`));
        }
      }

      if (completed.length > 0) {
        console.log(chalk.bold('\n✅ Recently Completed:\n'));
        completed.slice(-5).forEach(task => {
          const status = task.status === 'completed' ? chalk.green('✓') : chalk.red('✗');
          console.log(`  ${status} ${task.track.name}`);
        });
      }

      console.log();
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });
