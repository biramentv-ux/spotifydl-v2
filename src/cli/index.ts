#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import { downloadCommand } from './commands/download';
import { searchCommand } from './commands/search';
import { queueCommand } from './commands/queue';
import { configCommand } from './commands/config';
import { statusCommand } from './commands/status';
import { loginCommand } from './commands/login';
import { statsCommand } from './commands/stats';
import { visualizerCommand } from './commands/visualizer';
import { logger } from '../core/Logger';

const program = new Command();

// Banner
console.log(
  chalk.green(
    figlet.textSync('SpotifyDL', { font: 'Small' })
  )
);
console.log(chalk.gray('v2.0.0 - Hybrid Music Downloader\n'));

program
  .name('spotify-dl')
  .description('Advanced Spotify music downloader with multiple decryption engines')
  .version('2.0.0')
  .option('-v, --verbose', 'verbose output')
  .option('-q, --quiet', 'suppress non-error output')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.verbose) {
      logger.level = 'debug';
    }
    if (opts.quiet) {
      logger.level = 'error';
    }
  });

// Register commands
program.addCommand(downloadCommand);
program.addCommand(searchCommand);
program.addCommand(queueCommand);
program.addCommand(configCommand);
program.addCommand(statusCommand);
program.addCommand(loginCommand);
program.addCommand(statsCommand);
program.addCommand(visualizerCommand);

// Default action
program.action(() => {
  program.help();
});

program.parse();
