import { Router } from 'express';
import crypto from 'crypto';
import { logger } from '../core/Logger';
import { eventBus } from '../core/EventBus';
import { DownloadManager } from '../download/DownloadManager';

export interface WebhookEvent {
  id: string;
  type: string;
  payload: any;
  signature: string;
  timestamp: number;
}

export class WebhookServer {
  private router: Router;
  private downloadManager: DownloadManager;
  private secret: string;
  private endpoints: Map<string, (event: WebhookEvent) => Promise<void>> = new Map();

  constructor(downloadManager: DownloadManager, secret: string = process.env.WEBHOOK_SECRET || '') {
    this.router = Router();
    this.downloadManager = downloadManager;
    this.secret = secret;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // GitHub-style webhook endpoint
    this.router.post('/webhook/:eventType', async (req, res) => {
      const eventType = req.params.eventType;
      const signature = req.headers['x-webhook-signature'] as string;
      const payload = req.body;

      // Verify signature if secret is configured
      if (this.secret && !this.verifySignature(payload, signature)) {
        logger.warn('Invalid webhook signature');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      const event: WebhookEvent = {
        id: crypto.randomUUID(),
        type: eventType,
        payload,
        signature: signature || '',
        timestamp: Date.now()
      };

      logger.info(`📡 Webhook received: ${eventType}`, { eventId: event.id });

      // Process event
      await this.processEvent(event);

      res.status(200).json({ received: true, id: event.id });
    });

    // Health check
    this.router.get('/webhook/health', (req, res) => {
      res.json({ status: 'ok', endpoints: Array.from(this.endpoints.keys()) });
    });
  }

  private async processEvent(event: WebhookEvent): Promise<void> {
    const handler = this.endpoints.get(event.type);

    if (handler) {
      try {
        await handler(event);
      } catch (error) {
        logger.error(`Webhook handler failed for ${event.type}`, { error });
      }
    }

    // Emit event for other listeners
    eventBus.emit('plugin:lifecycle', {
      pluginId: 'webhook',
      type: 'loaded'
    });
  }

  private verifySignature(payload: any, signature: string): boolean {
    if (!signature) return false;

    const hmac = crypto.createHmac('sha256', this.secret);
    const digest = hmac.update(JSON.stringify(payload)).digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(digest)
    );
  }

  registerEndpoint(eventType: string, handler: (event: WebhookEvent) => Promise<void>): void {
    this.endpoints.set(eventType, handler);
    logger.info(`📡 Webhook endpoint registered: ${eventType}`);
  }

  unregisterEndpoint(eventType: string): void {
    this.endpoints.delete(eventType);
    logger.info(`📡 Webhook endpoint unregistered: ${eventType}`);
  }

  getRouter(): Router {
    return this.router;
  }

  // Built-in handlers
  setupBuiltinHandlers(): void {
    // Download completed webhook
    this.registerEndpoint('download.complete', async (event) => {
      logger.info('Download completed webhook processed', { payload: event.payload });
    });

    // New release webhook
    this.registerEndpoint('release.new', async (event) => {
      logger.info('New release webhook processed', { payload: event.payload });
    });

    // System alert webhook
    this.registerEndpoint('system.alert', async (event) => {
      logger.warn('System alert webhook', { payload: event.payload });
    });
  }
}
