import { ConfigManager } from './core/ConfigManager';
import { SpotifyDLApp } from './core/SpotifyDLApp';
import { eventBus } from './core/EventBus';
import { logger } from './core/Logger';
import { AuthManager } from './auth/AuthManager';
import { XPSystem } from './auth/XPSystem';
import { BadgeSystem } from './auth/BadgeSystem';
import { DownloadManager } from './download/DownloadManager';
import { HybridEngine } from './download/engines/HybridEngine';
import { PluginManager } from './plugins/PluginManager';
import { VisualizerEngine } from './visualizer/VisualizerEngine';
import { WebSocketServer } from './websocket/WebSocketServer';
import { TelegramBot } from './bot/TelegramBot';
import { WebhookManager } from './webhook/WebhookManager';
import { CloudManager } from './cloud/CloudManager';
import { Neo4jClient } from './neo4j/Neo4jClient';
import { runMigrations } from './neo4j/migrations';
import { seedDatabase } from './neo4j/seeders';
import { GraphQLServer } from './graphql/GraphQLServer';
import { createAPIRouter } from './api/routes';
import { Updater } from './updater/Updater';
import { RecommendationEngine } from './ml/RecommendationEngine';
import { SpotifyAPI } from './core/SpotifyAPI';

async function bootstrap(): Promise<void> {
  try {
    // Load configuration
    const config = new ConfigManager();
    await config.load();
    logger.info('Configuration loaded');

    // Initialize core services
    const authManager = new AuthManager(config);
    const spotifyAPI = new SpotifyAPI();
    const engine = new HybridEngine();
    const downloadManager = new DownloadManager(config, engine);
    const xpConfig = config.get('xp');
    const xpSystem = new XPSystem(xpConfig.baseThreshold, xpConfig.multiplier, xpConfig.dailyBonus);
    const badgeSystem = new BadgeSystem();
    const webhookManager = new WebhookManager();
    const updater = new Updater(config);
    const pluginManager = new PluginManager(config.get('plugins').directory, config.get('plugins').timeout);
    const visualizer = new VisualizerEngine(config.get('visualizer').ffmpegPath);
    const cloudManager = new CloudManager(config);

    // Load plugins
    await pluginManager.loadPlugins();

    // Initialize Neo4j (optional)
    const neo4jClient = new Neo4jClient(config);
    try {
      await neo4jClient.connect();
      await runMigrations(neo4jClient);
      await seedDatabase(neo4jClient);
    } catch (error) {
      logger.warn('Neo4j connection failed, continuing without graph database');
    }

    const recommendationEngine = new RecommendationEngine(spotifyAPI, neo4jClient);

    // Initialize main app
    const app = new SpotifyDLApp(config, eventBus);

    // Setup GraphQL
    const graphqlServer = new GraphQLServer(authManager, downloadManager, spotifyAPI);
    await graphqlServer.start();
    app.app.use('/graphql', graphqlServer.getMiddleware());

    // Setup REST API
    app.app.use('/api/v1', createAPIRouter(config, authManager, downloadManager, xpSystem, badgeSystem, spotifyAPI));

    // Setup webhooks
    app.app.use('/webhooks', webhookManager.getRouter());

    // Setup WebSocket
    const wsServer = new WebSocketServer(app.server, downloadManager);

    // Setup Telegram bot (optional)
    let telegramBot: TelegramBot | null = null;
    try {
      telegramBot = new TelegramBot(config, downloadManager, spotifyAPI);
      await telegramBot.start();
    } catch (error) {
      logger.warn('Telegram bot not started (missing or invalid token), continuing without bot');
    }

    // Setup updater
    updater.start();

    // Wire event forwarding
    eventBus.on('download:complete', async (data) => {
      await webhookManager.trigger('download:complete', data);
    });
    eventBus.on('download:error', async (data) => {
      await webhookManager.trigger('download:error', data);
    });

    // Listen for system shutdown to clean up additional resources
    eventBus.on('system:shutdown', async () => {
      logger.info('Cleaning up additional resources...');
      updater.stop();
      wsServer.close();
      if (telegramBot) await telegramBot.stop();
      await neo4jClient.close();
      await graphqlServer.stop();
    });

    // Start server
    await app.start();
    logger.info('SpotifyDL v2 fully initialized');
  } catch (error) {
    logger.error('Bootstrap failed', { error });
    process.exit(1);
  }
}

bootstrap();
