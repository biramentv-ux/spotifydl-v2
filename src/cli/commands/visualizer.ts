import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import { VisualizerEngine } from '../../visualizer/VisualizerEngine';

export const visualizerCommand = new Command('visualizer')
  .alias('viz')
  .description('Generate audio visualizations')
  .argument('<audio-file>', 'path to audio file')
  .option('-m, --mode <mode>', 'visualization mode (waveform, spectrum, particle, ascii)', 'waveform')
  .option('-w, --width <pixels>', 'output width', '1920')
  .option('-h, --height <pixels>', 'output height', '1080')
  .option('-f, --fps <fps>', 'frames per second', '30')
  .option('-o, --output <path>', 'output file path')
  .option('--list-modes', 'list available visualization modes')
  .action(async (audioFile, options) => {
    if (options.listModes) {
      const visualizer = new VisualizerEngine();
      console.log(chalk.bold('\n🎨 Available Visualization Modes\n'));
      visualizer.getAvailableModes().forEach(mode => {
        const descriptions: Record<string, string> = {
          waveform: 'Classic waveform visualization',
          spectrum: 'Frequency spectrum analyzer',
          particle: 'Particle-based audio reactive visualization',
          ascii: 'ASCII art style waveform'
        };
        console.log(`  ${chalk.cyan(mode)} - ${chalk.gray(descriptions[mode] || '')}`);
      });
      console.log();
      return;
    }

    if (!fs.existsSync(audioFile)) {
      console.error(chalk.red(`❌ File not found: ${audioFile}`));
      process.exit(1);
    }

    const spinner = ora('Generating visualization...').start();

    try {
      const visualizer = new VisualizerEngine();
      const outputPath = options.output || audioFile.replace(/\.[^.]+$/, `_${options.mode}.mp4`);

      const result = await visualizer.render(audioFile, {
        mode: options.mode as any,
        width: parseInt(options.width),
        height: parseInt(options.height),
        fps: parseInt(options.fps)
      });

      spinner.succeed(chalk.green('Visualization generated!'));
      console.log(chalk.gray(`  Mode: ${result.mode}`));
      console.log(chalk.gray(`  File: ${result.filePath}`));
      console.log(chalk.gray(`  Frames: ${result.frames}`));
      console.log(chalk.gray(`  Duration: ${result.duration.toFixed(1)}s`));
      console.log();
    } catch (error: any) {
      spinner.fail(chalk.red(`Visualization failed: ${error.message}`));
      process.exit(1);
    }
  });
