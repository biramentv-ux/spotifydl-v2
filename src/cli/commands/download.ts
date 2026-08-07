import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager } from '../../core/ConfigManager';
import { SpotifyAPI } from '../../core/SpotifyAPI';
import { DownloadManager, DownloadTask } from '../../download/DownloadManager';
import { HybridEngine } from '../../download/engines/HybridEngine';
import { MetadataEmbedder } from '../../metadata/MetadataEmbedder';
import { LRCLIBClient } from '../../metadata/LRCLIBClient';
import { Validators } from '../../utils/Validators';
import { logger } from '../../core/Logger';

export const downloadCommand = new Command('download')
  .alias('dl')
  .description('Download tracks, albums, or playlists from Spotify')
  .argument('<url-or-id>', 'Spotify URL or track ID')
  .option('-f, --format <format>', 'output format (mp3, flac, ogg)', 'mp3')
  .option('-q, --quality <quality>', 'audio quality (low, medium, high)', 'high')
  .option('-o, --output <dir>', 'output directory', './downloads')
  .option('--no-metadata', 'skip metadata embedding')
  .option('--no-lyrics', 'skip lyrics fetch')
  .option('--visualize <mode>', 'generate visualization (waveform, spectrum, particle)')
  .action(async (urlOrId, options) => {
    const spinner = ora('Initializing...').start();

    try {
      const config = new ConfigManager();
      await config.load();

      const spotifyAPI = new SpotifyAPI();
      const engine = new HybridEngine();
      const downloadManager = new DownloadManager(config, engine);
      const metadataEmbedder = new MetadataEmbedder();
      const lrclib = new LRCLIBClient();

      // Parse URL or ID
      let trackId = urlOrId;
      const urlValidation = Validators.isValidSpotifyUrl(urlOrId);
      
      if (urlValidation.id) {
        trackId = urlValidation.id;
      } else if (!Validators.isValidSpotifyId(urlOrId)) {
        spinner.fail(chalk.red('Invalid Spotify URL or track ID'));
        process.exit(1);
      }

      spinner.text = 'Fetching track info...';
      const track = await spotifyAPI.getTrack(trackId);

      spinner.text = `Downloading: ${chalk.cyan(track.name)} by ${chalk.cyan(track.artists.map(a => a.name).join(', '))}`;

      // Setup progress listener
      downloadManager.on('download:progress', (task) => {
        if (task.track.id === trackId) {
          const bar = '█'.repeat(Math.floor(task.progress / 5)) + '░'.repeat(20 - Math.floor(task.progress / 5));
          spinner.text = `${chalk.cyan(track.name)} [${bar}] ${task.progress.toFixed(1)}% @ ${(task.speed / 1024).toFixed(1)} KB/s`;
        }
      });

      const taskId = downloadManager.addToQueue(track);

      // Wait for completion with race-condition safety
      const task = await new Promise<DownloadTask>((resolve, reject) => {
        // Check if already completed (race condition guard)
        const existing = downloadManager.getTask(taskId);
        if (existing?.status === 'completed') {
          resolve(existing);
          return;
        }
        if (existing?.status === 'failed') {
          reject(new Error(existing.error || 'Download failed'));
          return;
        }

        const onComplete = (t: DownloadTask) => {
          if (t.id === taskId) {
            cleanup();
            resolve(t);
          }
        };
        const onError = (t: DownloadTask) => {
          if (t.id === taskId) {
            cleanup();
            reject(new Error(t.error || 'Download failed'));
          }
        };
        const cleanup = () => {
          downloadManager.off('download:complete', onComplete);
          downloadManager.off('download:error', onError);
        };

        downloadManager.on('download:complete', onComplete);
        downloadManager.on('download:error', onError);
      });

      if (!task.filePath) {
        throw new Error('Download completed but no file path');
      }

      // Embed metadata
      if (options.metadata !== false) {
        spinner.text = 'Embedding metadata...';
        const embedOptions: any = {};

        // Fetch cover art
        if (track.album.images?.[0]?.url) {
          embedOptions.coverArt = await metadataEmbedder.fetchCoverArt(track.album.images[0].url);
        }

        // Fetch lyrics
        if (options.lyrics !== false) {
          const lyrics = await lrclib.getLyrics(track.name, track.artists[0].name, track.album.name);
          if (lyrics) {
            embedOptions.lyrics = {
              plain: lyrics.plainLyrics,
              synced: lyrics.syncedLyrics ? lrclib.parseSyncedLyrics(lyrics.syncedLyrics) : undefined,
              source: 'LRCLIB'
            };
          }
        }

        await metadataEmbedder.embedMetadata(task.filePath, track, embedOptions);
      }

      spinner.succeed(chalk.green(`Downloaded: ${track.name}`));
      console.log(chalk.gray(`  File: ${task.filePath}`));
      console.log(chalk.gray(`  Size: ${(task.totalBytes / 1024 / 1024).toFixed(2)} MB`));

      // Visualizer
      if (options.visualize) {
        const { VisualizerEngine } = await import('../../visualizer/VisualizerEngine');
        const visualizer = new VisualizerEngine();
        const vizResult = await visualizer.render(task.filePath, {
          mode: options.visualize,
          width: 1920,
          height: 1080,
          fps: 30
        });
        console.log(chalk.gray(`  Visualization: ${vizResult.filePath}`));
      }

    } catch (error: any) {
      spinner.fail(chalk.red(`Download failed: ${error.message}`));
      logger.error('CLI download failed', { error });
      process.exit(1);
    }
  });
