import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import open from 'open';
import { ConfigManager } from '../../core/ConfigManager';
import { AuthManager } from '../../auth/AuthManager';

export const loginCommand = new Command('login')
  .description('Authenticate with Spotify OAuth2')
  .option('--no-browser', 'do not open browser automatically')
  .action(async (options) => {
    const spinner = ora('Preparing authentication...').start();

    try {
      const config = new ConfigManager();
      await config.load();

      const authManager = new AuthManager(config);
      const state = `cli_${Date.now()}`;
      const authUrl = authManager.getAuthUrl(state);

      spinner.stop();

      console.log(chalk.bold('\n🔐 Spotify Authentication\n'));
      console.log(chalk.gray('Opening browser for authentication...'));
      console.log(chalk.gray('If the browser does not open, use this URL:'));
      console.log(chalk.cyan(authUrl));
      console.log();

      if (options.browser !== false) {
        await open(authUrl);
      }

      console.log(chalk.yellow('Waiting for authentication...'));
      console.log(chalk.gray('(In a real implementation, this would start a local server to receive the callback)'));

      // In real implementation, start a temporary HTTP server to capture the callback
      // For now, instruct the user
      console.log(chalk.bold('\nInstructions:'));
      console.log('1. Log in to Spotify in the opened browser');
      console.log('2. Authorize SpotifyDL');
      console.log('3. Copy the authorization code from the redirect URL');
      console.log('4. Run: spotify-dl auth <code>');
      console.log();

    } catch (error: any) {
      spinner.fail(chalk.red(`Login failed: ${error.message}`));
      process.exit(1);
    }
  });
