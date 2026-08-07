import { Server as HTTPServer } from 'http';
import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { logger } from '../core/Logger';
import { eventBus } from '../core/EventBus';
import { DownloadManager } from '../download/DownloadManager';

export interface WSClient {
  id: string;
  ws: WebSocket;
  userId?: string;
  subscriptions: Set<string>;
}

export class WebSocketServer {
  private wss: WSServer;
  private clients: Map<string, WSClient> = new Map();
  private downloadManager: DownloadManager;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(server: HTTPServer, downloadManager: DownloadManager) {
    this.downloadManager = downloadManager;
    this.wss = new WSServer({ server, path: '/ws' });
    this.setupHandlers();
    this.setupEventForwarding();
    this.startHeartbeat();
  }

  private setupHandlers(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientId = this.generateClientId();
      const client: WSClient = {
        id: clientId,
        ws,
        subscriptions: new Set()
      };

      this.clients.set(clientId, client);
      logger.info(`🔌 WebSocket client connected: ${clientId} (${this.clients.size} total)`);

      ws.on('message', (data) => this.handleMessage(client, data));
      ws.on('close', () => this.handleDisconnect(client));
      ws.on('error', (error) => logger.error(`WS error for ${clientId}`, { error }));

      // Send welcome
      this.send(client, { type: 'connected', clientId });
    });
  }

  private handleMessage(client: WSClient, data: Buffer | ArrayBuffer | Buffer[]): void {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'subscribe':
          if (message.channel) {
            client.subscriptions.add(message.channel);
            this.send(client, { type: 'subscribed', channel: message.channel });
          }
          break;

        case 'unsubscribe':
          if (message.channel) {
            client.subscriptions.delete(message.channel);
          }
          break;

        case 'auth':
          if (message.userId) {
            client.userId = message.userId;
            this.send(client, { type: 'authenticated', userId: message.userId });
          }
          break;

        case 'ping':
          this.send(client, { type: 'pong', timestamp: Date.now() });
          break;

        case 'getQueue':
          this.send(client, {
            type: 'queue',
            data: this.downloadManager.getAllTasks()
          });
          break;

        default:
          this.send(client, { type: 'error', message: 'Unknown message type' });
      }
    } catch (error) {
      logger.error('WS message parse error', { error });
      this.send(client, { type: 'error', message: 'Invalid JSON' });
    }
  }

  private handleDisconnect(client: WSClient): void {
    this.clients.delete(client.id);
    logger.info(`🔌 WebSocket client disconnected: ${client.id} (${this.clients.size} remaining)`);
  }

  private setupEventForwarding(): void {
    // Forward download progress to subscribed clients
    eventBus.on('download:progress', (data) => {
      this.broadcast('download', data, (client) =>
        client.subscriptions.has('downloads') || client.subscriptions.has('all')
      );
    });

    eventBus.on('download:complete', (data) => {
      this.broadcast('download:complete', data, (client) =>
        client.subscriptions.has('downloads') || client.subscriptions.has('all')
      );
    });

    eventBus.on('xp:gain', (data) => {
      this.broadcast('xp', data, (client) =>
        client.userId === data.userId || client.subscriptions.has('all')
      );
    });

    eventBus.on('badge:award', (data) => {
      this.broadcast('badge', data, (client) =>
        client.userId === data.userId || client.subscriptions.has('all')
      );
    });
  }

  private broadcast(type: string, data: any, filter?: (client: WSClient) => boolean): void {
    const message = JSON.stringify({ type, data, timestamp: Date.now() });

    for (const client of this.clients.values()) {
      if (filter && !filter(client)) continue;
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    }
  }

  private send(client: WSClient, data: any): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(data));
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.broadcast('heartbeat', { timestamp: Date.now() });
    }, 30000);
  }

  private generateClientId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getStats(): { connected: number; subscriptions: Record<string, number> } {
    const subs: Record<string, number> = {};
    for (const client of this.clients.values()) {
      for (const sub of client.subscriptions) {
        subs[sub] = (subs[sub] || 0) + 1;
      }
    }
    return { connected: this.clients.size, subscriptions: subs };
  }

  close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    for (const client of this.clients.values()) {
      client.ws.close();
    }
    this.wss.close();
    logger.info('🔌 WebSocket server closed');
  }
}
