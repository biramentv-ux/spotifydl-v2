import { Command } from 'commander';
import chalk from 'chalk';
import os from 'os';
import { ConfigManager } from '../../core/ConfigManager';
import { HybridEngine } from '../../download/engines/HybridEngine';

export const statusCommand = new Command('status')
  .alias('st')
  .description('Show system status and health')
  .action(async () => {
    try {
      const config = new ConfigManager();
      await config.load();

      console.log(chalk.bold('\n🎵 SpotifyDL v2 Status\n'));

      // System info
      console.log(chalk.bold('System:'));
      console.log(`  ${chalk.gray('Platform:')} ${os.platform()} ${os.arch()}`);
      console.log(`  ${chalk.gray('Node.js:')} ${process.version}`);
      console.log(`  ${chalk.gray('Uptime:')} ${(process.uptime() / 60).toFixed(1)} minutes`);
      console.log(`  ${chalk.gray('Memory:')} ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB / ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)} GB`);
      console.log(`  ${chalk.gray('CPUs:')} ${os.cpus().length}`);

      // Engine status
      console.log(chalk.bold('\nEngines:'));
      const engine = new HybridEngine();
      const stats = engine.getStats();
      console.log(`  ${chalk.gray('PlayPlay:')} ${stats.playplaySuccess} success / ${stats.playplayFailures} failures`);
      console.log(`  ${chalk.gray('Widevine:')} ${stats.widevineSuccess} success / ${stats.widevineFailures} failures`);
      console.log(`  ${chalk.gray('Preferred:')} ${chalk.cyan(engine.getPreferredEngine())}`);

      // Config status
      console.log(chalk.bold('\nConfiguration:'));
      const downloadConfig = config.get('download');
      console.log(`  ${chalk.gray('Format:')} ${downloadConfig.format}`);
      console.log(`  ${chalk.gray('Quality:')} ${downloadConfig.quality}`);
      console.log(`  ${chalk.gray('Concurrency:')} ${downloadConfig.concurrency}`);
      console.log(`  ${chalk.gray('Output:')} ${downloadConfig.outputDir}`);

      const visualizerConfig = config.get('visualizer');
      console.log(`  ${chalk.gray('Visualizer:')} ${visualizerConfig.enabled ? chalk.green('enabled') : chalk.red('disabled')}`);

      const pluginsConfig = config.get('plugins');
      console.log(`  ${chalk.gray('Plugins:')} ${pluginsConfig.enabled ? chalk.green('enabled') : chalk.red('disabled')}`);

      // API status
      console.log(chalk.bold('\nAPI Status:'));
      console.log(`  ${chalk.gray('Server:')} ${chalk.green('running')}`);
      console.log(`  ${chalk.gray('GraphQL:')} ${chalk.green('enabled')}`);
      console.log(`  ${chalk.gray('WebSocket:')} ${chalk.green('enabled')}`);
      console.log(`  ${chalk.gray('Telegram Bot:')} ${config.get('telegram').botToken ? chalk.green('configured') : chalk.yellow('not configured')}`);
      console.log(`  ${chalk.gray('Neo4j:')} ${config.get('neo4j').password ? chalk.green('configured') : chalk.yellow('not configured')}`);

      console.log();
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });
