import { logger } from '../core/Logger';
import { GraphQLContext } from './GraphQLServer';

export const resolvers = {
  Query: {
    health: () => ({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }),

    track: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      try {
        return await context.spotifyAPI.getTrack(id);
      } catch (error) {
        logger.error('GraphQL: Failed to fetch track', { id, error });
        throw error;
      }
    },

    search: async (_: any, { query, type = 'track', limit = 20 }: any, context: GraphQLContext) => {
      try {
        const result = await context.spotifyAPI.search(query, type, limit);
        // Transform Spotify API response to GraphQL schema format
        return {
          tracks: result.tracks?.items || [],
          albums: result.albums?.items || [],
          artists: result.artists?.items || [],
          playlists: result.playlists?.items || []
        };
      } catch (error) {
        logger.error('GraphQL: Search failed', { query, error });
        throw error;
      }
    },

    downloadQueue: (_: any, __: any, context: GraphQLContext) => {
      return context.downloadManager.getQueue();
    },

    downloadHistory: (_: any, __: any, context: GraphQLContext) => {
      return context.downloadManager.getCompleted();
    },

    downloadStats: (_: any, __: any, context: GraphQLContext) => {
      return context.downloadManager.getStats();
    },

    me: (_: any, __: any, context: GraphQLContext) => {
      if (!context.userId) return null;
      const session = context.authManager.getSession(context.userId);
      if (!session) return null;
      return {
        id: session.userId,
        displayName: session.profile.displayName,
        email: session.profile.email,
        images: session.profile.images
      };
    },

    sessions: (_: any, __: any, context: GraphQLContext) => {
      return context.authManager.getAllSessions().map(s => ({
        userId: s.userId,
        displayName: s.profile.displayName,
        expiresAt: s.expiresAt,
        isValid: context.authManager.isSessionValid(s.userId)
      }));
    },

    leaderboard: (_: any, { limit = 10 }: { limit?: number }, context: GraphQLContext) => {
      // XPSystem is not in GraphQLContext - need to handle this
      return [];
    },

    userBadges: (_: any, { userId }: { userId: string }, context: GraphQLContext) => {
      return [];
    }
  },

  Mutation: {
    queueDownload: async (_: any, { trackId }: { trackId: string }, context: GraphQLContext) => {
      const track = await context.spotifyAPI.getTrack(trackId);
      const taskId = context.downloadManager.addToQueue(track);
      return context.downloadManager.getTask(taskId);
    },

    queuePlaylist: async (_: any, { playlistId }: { playlistId: string }, context: GraphQLContext) => {
      const tracks = await context.spotifyAPI.getPlaylistTracks(playlistId);
      const taskIds = context.downloadManager.addPlaylistToQueue(tracks);
      return taskIds.map(id => context.downloadManager.getTask(id));
    },

    cancelDownload: (_: any, { taskId }: { taskId: string }, context: GraphQLContext) => {
      return context.downloadManager.cancelDownload(taskId);
    },

    clearHistory: (_: any, __: any, context: GraphQLContext) => {
      context.downloadManager.clearCompleted();
      return true;
    },

    logout: (_: any, __: any, context: GraphQLContext) => {
      if (context.userId) {
        context.authManager.logout(context.userId);
        return true;
      }
      return false;
    }
  },

  Subscription: {
    downloadProgress: {
      subscribe: () => {
        // Would use PubSub in real implementation
        return (async function* () {
          while (true) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            yield { downloadProgress: { taskId: '', trackId: '', progress: 0, speed: 0, status: 'idle' } };
          }
        })();
      }
    }
  }
};
