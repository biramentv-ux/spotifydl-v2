import http from 'http';
import WebSocket from 'ws';
import { WebSocketServer } from '../../src/websocket/WebSocketServer';
import { DownloadManager } from '../../src/download/DownloadManager';
import { ConfigManager } from '../../src/core/ConfigManager';

// Mock external dependencies
jest.mock('../../src/core/Logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    verbose: jest.fn()
  }
}));

jest.mock('../../src/core/EventBus', () => ({
  eventBus: {
    on: jest.fn(),
    emit: jest.fn()
  }
}));

describe('WebSocket Integration', () => {
  let server: http.Server;
  let wss: WebSocketServer;
  let wsUrl: string;
  let downloadManager: DownloadManager;

  beforeAll((done) => {
    const config = {
      get: jest.fn().mockReturnValue({
        concurrency: 3,
        outputDir: './downloads',
        format: 'mp3',
        quality: 'high'
      })
    } as any;

    const engine = {
      download: jest.fn().mockResolvedValue('/downloads/test.mp3')
    } as any;

    downloadManager = new DownloadManager(config, engine);

    server = http.createServer();
    wss = new WebSocketServer(server, downloadManager);

    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as any;
      wsUrl = `ws://127.0.0.1:${address.port}/ws`;
      done();
    });
  });

  afterAll((done) => {
    wss.close();
    server.close(done);
  });

  describe('Connection', () => {
    it('should connect and receive welcome message', (done) => {
      const ws = new WebSocket(wsUrl);

      ws.on('open', () => {
        // Connection opened
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        expect(msg.type).toBe('connected');
        expect(msg.clientId).toBeDefined();
        expect(typeof msg.clientId).toBe('string');
        ws.close();
        done();
      });

      ws.on('error', (err) => {
        done(err);
      });
    });

    it('should handle multiple concurrent connections', (done) => {
      const connections: WebSocket[] = [];
      const messages: any[] = [];
      let connected = 0;

      for (let i = 0; i < 3; i++) {
        const ws = new WebSocket(wsUrl);
        connections.push(ws);

        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'connected') {
            messages.push(msg);
            connected++;
            if (connected === 3) {
              expect(messages).toHaveLength(3);
              expect(new Set(messages.map(m => m.clientId)).size).toBe(3);
              connections.forEach(c => c.close());
              done();
            }
          }
        });
      }
    });
  });

  describe('Message handling', () => {
    it('should handle ping/pong', (done) => {
      const ws = new WebSocket(wsUrl);
      let welcomeReceived = false;

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'connected') {
          welcomeReceived = true;
          ws.send(JSON.stringify({ type: 'ping' }));
        } else if (msg.type === 'pong' && welcomeReceived) {
          expect(msg.timestamp).toBeDefined();
          expect(typeof msg.timestamp).toBe('number');
          ws.close();
          done();
        }
      });
    });

    it('should handle getQueue message', (done) => {
      const ws = new WebSocket(wsUrl);
      let welcomeReceived = false;

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'connected') {
          welcomeReceived = true;
          ws.send(JSON.stringify({ type: 'getQueue' }));
        } else if (msg.type === 'queue' && welcomeReceived) {
          expect(Array.isArray(msg.data)).toBe(true);
          ws.close();
          done();
        }
      });
    });

    it('should handle subscribe/unsubscribe', (done) => {
      const ws = new WebSocket(wsUrl);
      let step = 0;

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'connected') {
          step = 1;
          ws.send(JSON.stringify({ type: 'subscribe', channel: 'downloads' }));
        } else if (msg.type === 'subscribed' && step === 1) {
          expect(msg.channel).toBe('downloads');
          step = 2;
          ws.send(JSON.stringify({ type: 'unsubscribe', channel: 'downloads' }));
          ws.close();
          done();
        }
      });
    });

    it('should handle auth message', (done) => {
      const ws = new WebSocket(wsUrl);
      let welcomeReceived = false;

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'connected') {
          welcomeReceived = true;
          ws.send(JSON.stringify({ type: 'auth', userId: 'test-user-123' }));
        } else if (msg.type === 'authenticated' && welcomeReceived) {
          expect(msg.userId).toBe('test-user-123');
          ws.close();
          done();
        }
      });
    });

    it('should return error for unknown message type', (done) => {
      const ws = new WebSocket(wsUrl);
      let welcomeReceived = false;

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'connected') {
          welcomeReceived = true;
          ws.send(JSON.stringify({ type: 'unknown_type' }));
        } else if (msg.type === 'error' && welcomeReceived) {
          expect(msg.message).toBe('Unknown message type');
          ws.close();
          done();
        }
      });
    });

    it('should return error for invalid JSON', (done) => {
      const ws = new WebSocket(wsUrl);
      let welcomeReceived = false;

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'connected') {
          welcomeReceived = true;
          ws.send('not valid json {{{');
        } else if (msg.type === 'error' && welcomeReceived) {
          expect(msg.message).toBe('Invalid JSON');
          ws.close();
          done();
        }
      });
    });
  });

  describe('Server stats', () => {
    it('should return correct stats', (done) => {
      const ws = new WebSocket(wsUrl);

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'connected') {
          const stats = wss.getStats();
          expect(stats.connected).toBeGreaterThanOrEqual(1);
          expect(typeof stats.subscriptions).toBe('object');
          ws.close();
          done();
        }
      });
    });
  });

  describe('Disconnection', () => {
    it('should handle client disconnect gracefully', (done) => {
      const ws = new WebSocket(wsUrl);

      ws.on('open', () => {
        ws.close();
      });

      ws.on('close', () => {
        // Give server time to process disconnect
        setTimeout(() => {
          const stats = wss.getStats();
          expect(stats.connected).toBe(0);
          done();
        }, 100);
      });
    });
  });
});
