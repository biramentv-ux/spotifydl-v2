import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { json } from 'body-parser';
import { typeDefs } from './typeDefs';
import { resolvers } from './resolvers';
import { logger } from '../core/Logger';
import { AuthManager } from '../auth/AuthManager';
import { DownloadManager } from '../download/DownloadManager';
import { SpotifyAPI } from '../core/SpotifyAPI';
import { Application } from 'express';
import { Server as HTTPServer } from 'http';

export interface GraphQLContext {
  authManager: AuthManager;
  downloadManager: DownloadManager;
  spotifyAPI: SpotifyAPI;
  userId?: string;
}

export class GraphQLServer {
  private server: ApolloServer<GraphQLContext>;
  private authManager: AuthManager;
  private downloadManager: DownloadManager;
  private spotifyAPI: SpotifyAPI;

  constructor(authManager: AuthManager, downloadManager: DownloadManager, spotifyAPI: SpotifyAPI) {
    this.authManager = authManager;
    this.downloadManager = downloadManager;
    this.spotifyAPI = spotifyAPI;

    this.server = new ApolloServer<GraphQLContext>({
      typeDefs,
      resolvers,
      plugins: [],
      formatError: (error) => {
        logger.error('GraphQL Error', { error });
        return error;
      }
    });
  }

  async start(): Promise<void> {
    await this.server.start();
    logger.info('🚀 GraphQL server initialized');
  }

  getMiddleware() {
    return expressMiddleware(this.server, {
      context: async ({ req }): Promise<GraphQLContext> => {
        const token = req.headers.authorization?.replace('Bearer ', '');
        let userId: string | undefined;

        if (token) {
          try {
            const decoded = this.authManager.validateToken(token);
            if (decoded) {
              userId = decoded.userId;
            }
          } catch {
            // Invalid token
          }
        }

        return {
          authManager: this.authManager,
          downloadManager: this.downloadManager,
          spotifyAPI: this.spotifyAPI,
          userId
        };
      }
    });
  }

  async stop(): Promise<void> {
    await this.server.stop();
    logger.info('GraphQL server stopped');
  }
}
