import { Telegraf, Markup } from 'telegraf';
import { logger } from '../core/Logger';
import { eventBus } from '../core/EventBus';
import { ConfigManager } from '../core/ConfigManager';
import { DownloadManager } from '../download/DownloadManager';
import { SpotifyAPI } from '../core/SpotifyAPI';

export class TelegramBot {
  private bot: Telegraf;
  private downloadManager: DownloadManager;
  private spotifyAPI: SpotifyAPI;
  private adminChatId: string;
  private isRunning = false;

  constructor(config: ConfigManager, downloadManager: DownloadManager, spotifyAPI: SpotifyAPI) {
    const telegramConfig = config.get('telegram');
    this.bot = new Telegraf(telegramConfig.botToken);
    this.downloadManager = downloadManager;
    this.spotifyAPI = spotifyAPI;
    this.adminChatId = telegramConfig.adminChatId;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    this.setupHandlers();
    await this.bot.launch();
    this.isRunning = true;

    logger.info('🤖 Telegram bot started');
    await this.notifyAdmin('🎵 SpotifyDL v2 bot is online!');

    process.once('SIGINT', () => this.bot.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
  }

  private setupHandlers(): void {
    this.bot.start(async (ctx) => {
      await ctx.reply(
        '🎵 *SpotifyDL v2 Bot*\n\n' +
        'Commands:\n' +
        '/search <query> - Search tracks\n' +
        '/download <trackId> - Queue download\n' +
        '/queue - Show download queue\n' +
        '/stats - Show statistics\n' +
        '/help - Show help',
        { parse_mode: 'Markdown' }
      );
    });

    this.bot.command('search', async (ctx) => {
      const query = ctx.message.text.split(' ').slice(1).join(' ');

      if (!query) {
        await ctx.reply('❌ Please provide a search query');
        return;
      }

      try {
        await ctx.replyWithChatAction('typing');
        const results = await this.spotifyAPI.search(query, 'track', 5);

        if (!results.tracks?.items?.length) {
          await ctx.reply('🔍 No tracks found');
          return;
        }

        const keyboard = results.tracks.items.map((track: any) => [
          Markup.button.callback(`${track.artists[0].name} - ${track.name}`, `dl:${track.id}`)
        ]);

        await ctx.reply('🔍 *Search Results:*', {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(keyboard)
        });
      } catch (error) {
        logger.error('Telegram search failed', { error });
        await ctx.reply('❌ Search failed');
      }
    });

    this.bot.command('download', async (ctx) => {
      const trackId = ctx.message.text.split(' ')[1];

      if (!trackId) {
        await ctx.reply('❌ Please provide a track ID');
        return;
      }

      try {
        await ctx.replyWithChatAction('typing');
        const track = await this.spotifyAPI.getTrack(trackId);
        const taskId = this.downloadManager.addToQueue(track);

        await ctx.reply(
          `⬇️ *Queued:* ${track.name}\n` +
          `by ${track.artists.map((a: any) => a.name).join(', ')}\n` +
          `Task ID: \`${taskId}\``,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        logger.error('Telegram download failed', { error });
        await ctx.reply('❌ Failed to queue download');
      }
    });

    this.bot.command('queue', async (ctx) => {
      const stats = this.downloadManager.getStats();
      const queue = this.downloadManager.getQueue();
      const active = this.downloadManager.getActive();

      let text = '📋 *Download Queue*\n\n';
      text += `Queued: ${stats.queued}\n`;
      text += `Active: ${stats.active}\n`;
      text += `Completed: ${stats.completed}\n`;
      text += `Failed: ${stats.failed}\n\n`;

      if (active.length > 0) {
        text += '*Currently downloading:*\n';
        for (const task of active) {
          text += `▶️ ${task.track.name} (${task.progress.toFixed(1)}%)\n`;
        }
      }

      if (queue.length > 0) {
        text += '\n*Up next:*\n';
        for (const task of queue.slice(0, 5)) {
          text += `⏳ ${task.track.name}\n`;
        }
      }

      await ctx.reply(text, { parse_mode: 'Markdown' });
    });

    this.bot.command('stats', async (ctx) => {
      const stats = this.downloadManager.getStats();

      await ctx.reply(
        '📊 *Statistics*\n\n' +
        `⏳ Queued: ${stats.queued}\n` +
        `▶️ Active: ${stats.active}\n` +
        `✅ Completed: ${stats.completed}\n` +
        `❌ Failed: ${stats.failed}`,
        { parse_mode: 'Markdown' }
      );
    });

    this.bot.on('callback_query', async (ctx) => {
      const callbackQuery = ctx.callbackQuery;
      if (!callbackQuery || !('data' in callbackQuery)) return;

      const data = callbackQuery.data as string;
      const chatId = callbackQuery.message?.chat.id;

      if (!data || !chatId) return;

      if (data.startsWith('dl:')) {
        const trackId = data.split(':')[1];
        try {
          const track = await this.spotifyAPI.getTrack(trackId);
          const taskId = this.downloadManager.addToQueue(track);

          await ctx.answerCbQuery(`Queued: ${track.name}`);
          await ctx.reply(
            `⬇️ Queued: *${track.name}*\nTask: \`${taskId}\``,
            { parse_mode: 'Markdown' }
          );
        } catch (error) {
          await ctx.answerCbQuery('Failed to queue');
        }
      }
    });

    eventBus.on('download:complete', async (data: any) => {
      if (this.adminChatId) {
        await this.bot.telegram.sendMessage(this.adminChatId,
          `✅ Download complete\nTrack: ${data.trackId}\nFile: ${data.filePath}`
        );
      }
    });

    eventBus.on('download:error', async (data: any) => {
      if (this.adminChatId) {
        await this.bot.telegram.sendMessage(this.adminChatId,
          `❌ Download failed\nTrack: ${data.trackId}\nError: ${data.error?.message || 'Unknown'}`
        );
      }
    });
  }

  async notifyAdmin(message: string): Promise<void> {
    if (this.adminChatId) {
      try {
        await this.bot.telegram.sendMessage(this.adminChatId, message);
      } catch (error) {
        logger.error('Failed to notify admin', { error });
      }
    }
  }

  async stop(): Promise<void> {
    if (this.isRunning) {
      this.bot.stop();
      this.isRunning = false;
      logger.info('🤖 Telegram bot stopped');
    }
  }
}
