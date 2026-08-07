import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigManager } from '../../core/ConfigManager';

export const configCommand = new Command('config')
  .alias('cfg')
  .description('Manage configuration settings')
  .argument('[key]', 'configuration key (e.g., download.format)')
  .argument('[value]', 'value to set')
  .option('-l, --list', 'list all configuration values')
  .option('--reset', 'reset to default configuration')
  .action(async (key, value, options) => {
    try {
      const config = new ConfigManager();
      await config.load();

      if (options.list || (!key && !options.reset)) {
        const allConfig = config.getAll();
        console.log(chalk.bold('\n⚙️  Configuration\n'));
        
        const printObj = (obj: any, prefix = '') => {
          for (const [k, v] of Object.entries(obj)) {
            if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
              console.log(`${prefix}${chalk.cyan(k)}:`);
              printObj(v, prefix + '  ');
            } else {
              const displayValue = typeof v === 'string' && v.length > 50 
                ? v.substring(0, 50) + '...' 
                : v;
              console.log(`${prefix}${chalk.gray(k)}: ${chalk.green(displayValue)}`);
            }
          }
        };
        
        printObj(allConfig);
        console.log();
        return;
      }

      if (options.reset) {
        // Reset logic would go here
        console.log(chalk.yellow('⚠️ Reset not implemented in this version'));
        return;
      }

      if (key && value) {
        // Parse nested key
        const keys = key.split('.');
        let current: any = config.getAll();
        
        for (let i = 0; i < keys.length - 1; i++) {
          if (!current[keys[i]]) {
            current[keys[i]] = {};
          }
          current = current[keys[i]];
        }

        // Try to parse as number/boolean
        let parsedValue: any = value;
        if (value === 'true') parsedValue = true;
        else if (value === 'false') parsedValue = false;
        else if (!isNaN(Number(value))) parsedValue = Number(value);

        current[keys[keys.length - 1]] = parsedValue;
        console.log(chalk.green(`✅ Set ${key} = ${parsedValue}`));
      } else if (key) {
        const keys = key.split('.');
        let current: any = config.getAll();
        
        for (const k of keys) {
          current = current?.[k];
        }
        
        if (current !== undefined) {
          console.log(`${chalk.cyan(key)}: ${chalk.green(current)}`);
        } else {
          console.log(chalk.red(`❌ Key not found: ${key}`));
        }
      }
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });
