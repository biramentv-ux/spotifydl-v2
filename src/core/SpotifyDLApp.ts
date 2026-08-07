import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { logger } from './Logger';
import { ConfigManager } from './ConfigManager';
import { EventBus } from './EventBus';

export class SpotifyDLApp {
  public app: express.Application;
  public server: ReturnType<typeof createServer>;
  private config: ConfigManager;
  private eventBus: EventBus;
  private isShuttingDown = false;

  constructor(config: ConfigManager, eventBus: EventBus) {
    this.config = config;
    this.eventBus = eventBus;
    this.app = express();
    this.server = createServer(this.app);
    this.setupMiddleware();
    this.setupRoutes();
    this.setupGracefulShutdown();
  }

  private setupMiddleware(): void {
    const serverConfig = this.config.get('server');
    
    this.app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    }));
    
    this.app.use(cors({
      origin: serverConfig.cors.origin,
      methods: serverConfig.cors.methods
    }));
    
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.static('public'));
    
    // Request logging
    this.app.use((req, res, next) => {
      logger.verbose(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
      next();
    });
  }

  private setupRoutes(): void {
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    this.app.get('/api/config', (req, res) => {
      const safeConfig = { ...this.config.getAll() };
      // Remove sensitive data
      delete (safeConfig as any).spotify.clientSecret;
      delete (safeConfig as any).neo4j.password;
      delete (safeConfig as any).telegram.botToken;
      delete (safeConfig as any).cloud;
      res.json(safeConfig);
    });
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;
      
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      
      this.eventBus.emit('system:shutdown');
      
      this.server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });

      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  async start(): Promise<void> {
    const { port, host } = this.config.get('server');
    
    return new Promise((resolve, reject) => {
      this.server.listen(port, host, () => {
        logger.info(`🚀 SpotifyDL v2 server running on http://${host}:${port}`);
        resolve();
      }).on('error', reject);
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        logger.info('Server stopped');
        resolve();
      });
    });
  }
}
