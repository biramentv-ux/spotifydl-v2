import { Router } from 'express';
import { logger } from '../core/Logger';
import { eventBus } from '../core/EventBus';

export interface WebhookConfig {
  url: string;
  events: string[];
  secret?: string;
  active: boolean;
}

export class WebhookManager {
  private webhooks: Map<string, WebhookConfig> = new Map();
  private router: Router;

  constructor() {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.router.post('/register', (req, res) => {
      const { url, events, secret } = req.body;
      const id = this.generateWebhookId();
      this.webhooks.set(id, { url, events, secret, active: true });
      logger.info(`Webhook registered: ${url}`);
      res.json({ id, status: 'registered' });
    });

    this.router.delete('/:id', (req, res) => {
      const deleted = this.webhooks.delete(req.params.id);
      res.json({ deleted });
    });

    this.router.get('/', (_req, res) => {
      res.json(Array.from(this.webhooks.entries()).map(([id, config]) => ({ id, ...config })));
    });
  }

  getRouter(): Router {
    return this.router;
  }

  async trigger(event: string, payload: any): Promise<void> {
    for (const [id, config] of this.webhooks) {
      if (!config.active || !config.events.includes(event)) continue;
      
      try {
        await fetch(config.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(config.secret ? { 'X-Webhook-Secret': config.secret } : {})
          },
          body: JSON.stringify({ event, payload, timestamp: new Date().toISOString() })
        });
      } catch (error) {
        logger.error(`Webhook delivery failed: ${config.url}`, { error });
      }
    }
  }

  private generateWebhookId(): string {
    return `wh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }
}
