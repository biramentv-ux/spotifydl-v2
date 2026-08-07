import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../core/Logger';

export type VisualizerMode = 'waveform' | 'spectrum' | 'particle' | 'ascii';

export interface VisualizerOptions {
  mode: VisualizerMode;
  width: number;
  height: number;
  fps: number;
  duration?: number;
  colorScheme?: string;
  outputFormat?: 'mp4' | 'gif' | 'webm';
}

export interface RenderResult {
  filePath: string;
  mode: VisualizerMode;
  duration: number;
  frames: number;
}

export class VisualizerEngine {
  private ffmpegPath: string;
  private tempDir: string;

  constructor(ffmpegPath: string = 'ffmpeg', tempDir: string = './temp') {
    this.ffmpegPath = ffmpegPath;
    this.tempDir = tempDir;
  }

  async render(audioPath: string, options: VisualizerOptions): Promise<RenderResult> {
    const outputPath = path.join(
      this.tempDir,
      `viz_${Date.now()}.${options.outputFormat || 'mp4'}`
    );

    await fs.mkdir(this.tempDir, { recursive: true });

    logger.info(`🎨 Rendering ${options.mode} visualization for ${path.basename(audioPath)}`);

    switch (options.mode) {
      case 'waveform':
        return this.renderWaveform(audioPath, outputPath, options);
      case 'spectrum':
        return this.renderSpectrum(audioPath, outputPath, options);
      case 'particle':
        return this.renderParticle(audioPath, outputPath, options);
      case 'ascii':
        return this.renderAscii(audioPath, outputPath, options);
      default:
        throw new Error(`Unknown visualizer mode: ${options.mode}`);
    }
  }

  private async renderWaveform(
    audioPath: string,
    outputPath: string,
    options: VisualizerOptions
  ): Promise<RenderResult> {
    const args = [
      '-i', audioPath,
      '-filter_complex',
      `showwaves=s=${options.width}x${options.height}:mode=line:colors=${options.colorScheme || '#00ff00'}`,
      '-pix_fmt', 'yuv420p',
      '-r', String(options.fps),
      '-y',
      outputPath
    ];

    return this.runFFmpeg(args, outputPath, options);
  }

  private async renderSpectrum(
    audioPath: string,
    outputPath: string,
    options: VisualizerOptions
  ): Promise<RenderResult> {
    const args = [
      '-i', audioPath,
      '-filter_complex',
      `showspectrum=s=${options.width}x${options.height}:mode=combined:color=${options.colorScheme || 'intensity'}`,
      '-pix_fmt', 'yuv420p',
      '-r', String(options.fps),
      '-y',
      outputPath
    ];

    return this.runFFmpeg(args, outputPath, options);
  }

  private async renderParticle(
    audioPath: string,
    outputPath: string,
    options: VisualizerOptions
  ): Promise<RenderResult> {
    const args = [
      '-i', audioPath,
      '-filter_complex',
      `showcqt=s=${options.width}x${options.height}:bar_g=2:sono_g=4`,
      '-pix_fmt', 'yuv420p',
      '-r', String(options.fps),
      '-y',
      outputPath
    ];

    return this.runFFmpeg(args, outputPath, options);
  }

  private async renderAscii(
    audioPath: string,
    outputPath: string,
    options: VisualizerOptions
  ): Promise<RenderResult> {
    // ASCII art visualization - text-based
    const args = [
      '-i', audioPath,
      '-filter_complex',
      `showwaves=s=${options.width}x${options.height}:mode=cline`,
      '-pix_fmt', 'yuv420p',
      '-r', String(options.fps),
      '-y',
      outputPath
    ];

    return this.runFFmpeg(args, outputPath, options);
  }

  private runFFmpeg(args: string[], outputPath: string, options: VisualizerOptions): Promise<RenderResult> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let frames = 0;

      const ffmpeg = spawn(this.ffmpegPath, args);

      ffmpeg.stderr.on('data', (data) => {
        const output = data.toString();
        // Parse frame count from ffmpeg output
        const frameMatch = output.match(/frame=\s*(\d+)/);
        if (frameMatch) {
          frames = parseInt(frameMatch[1], 10);
        }
      });

      ffmpeg.on('close', (code) => {
        const duration = (Date.now() - startTime) / 1000;

        if (code === 0) {
          logger.info(`✅ Visualization rendered: ${outputPath} (${duration.toFixed(1)}s)`);
          resolve({
            filePath: outputPath,
            mode: options.mode,
            duration,
            frames
          });
        } else {
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });

      ffmpeg.on('error', (error) => {
        reject(error);
      });
    });
  }

  async cleanup(): Promise<void> {
    try {
      const files = await fs.readdir(this.tempDir);
      const vizFiles = files.filter(f => f.startsWith('viz_'));
      
      for (const file of vizFiles) {
        await fs.unlink(path.join(this.tempDir, file));
      }
      
      logger.debug(`Cleaned up ${vizFiles.length} visualization files`);
    } catch (error) {
      logger.warn('Failed to cleanup visualization temp files', { error });
    }
  }

  getAvailableModes(): VisualizerMode[] {
    return ['waveform', 'spectrum', 'particle', 'ascii'];
  }
}
