import axios, { AxiosInstance } from 'axios';
import { logger } from './Logger';
import { TokenExtractor } from './TokenExtractor';

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  album: {
    id: string;
    name: string;
    images: { url: string; height: number; width: number }[];
    release_date: string;
  };
  duration_ms: number;
  explicit: boolean;
  popularity: number;
  preview_url: string | null;
  track_number: number;
  // PlayPlay audio stream fields (populated by audio metadata API)
  file_id?: string;        // 40 hex chars (20 bytes) — for key derivation
  obfuscated_key?: string;  // 32 hex chars (16 bytes) — encrypted audio key
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  owner: { id: string; display_name: string };
  tracks: { total: number; items: { track: SpotifyTrack }[] };
  images: { url: string }[];
  public: boolean;
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  tracks: { items: SpotifyTrack[] };
  images: { url: string }[];
  release_date: string;
  total_tracks: number;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  images: { url: string }[];
  followers: { total: number };
  popularity: number;
}

export interface AudioFeatures {
  danceability: number;
  energy: number;
  key: number;
  loudness: number;
  mode: number;
  speechiness: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  valence: number;
  tempo: number;
}

export class SpotifyAPI {
  private client: AxiosInstance;
  private tokenExtractor: TokenExtractor;
  private baseURL = 'https://api.spotify.com/v1';

  constructor() {
    this.tokenExtractor = new TokenExtractor();
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000
    });
  }

  private async ensureAuth(): Promise<void> {
    const token = await this.tokenExtractor.extractAnonymousToken();
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  async getTrack(id: string): Promise<SpotifyTrack> {
    await this.ensureAuth();
    const response = await this.client.get(`/tracks/${id}`);
    return response.data;
  }

  async getTracks(ids: string[]): Promise<SpotifyTrack[]> {
    if (ids.length === 0) return [];
    await this.ensureAuth();
    
    const chunks = this.chunkArray(ids, 50);
    const results: SpotifyTrack[] = [];
    
    for (const chunk of chunks) {
      const response = await this.client.get('/tracks', {
        params: { ids: chunk.join(',') }
      });
      results.push(...response.data.tracks);
    }
    
    return results;
  }

  async getPlaylist(id: string, limit: number = 100): Promise<SpotifyPlaylist> {
    await this.ensureAuth();
    const response = await this.client.get(`/playlists/${id}`, {
      params: { limit }
    });
    return response.data;
  }

  async getPlaylistTracks(playlistId: string, offset: number = 0, limit: number = 100): Promise<SpotifyTrack[]> {
    await this.ensureAuth();
    const response = await this.client.get(`/playlists/${playlistId}/tracks`, {
      params: { offset, limit }
    });
    return response.data.items.map((item: any) => item.track).filter(Boolean);
  }

  async getAlbum(id: string): Promise<SpotifyAlbum> {
    await this.ensureAuth();
    const response = await this.client.get(`/albums/${id}`);
    return response.data;
  }

  async getArtist(id: string): Promise<SpotifyArtist> {
    await this.ensureAuth();
    const response = await this.client.get(`/artists/${id}`);
    return response.data;
  }

  async search(query: string, type: string = 'track', limit: number = 20): Promise<any> {
    await this.ensureAuth();
    const response = await this.client.get('/search', {
      params: { q: query, type, limit }
    });
    return response.data;
  }

  async getAudioFeatures(trackIds: string[]): Promise<AudioFeatures[]> {
    if (trackIds.length === 0) return [];
    await this.ensureAuth();
    
    const chunks = this.chunkArray(trackIds, 100);
    const results: AudioFeatures[] = [];
    
    for (const chunk of chunks) {
      const response = await this.client.get('/audio-features', {
        params: { ids: chunk.join(',') }
      });
      results.push(...response.data.audio_features.filter(Boolean));
    }
    
    return results;
  }

  async getRecommendations(seedTracks: string[], limit: number = 20): Promise<SpotifyTrack[]> {
    await this.ensureAuth();
    const response = await this.client.get('/recommendations', {
      params: {
        seed_tracks: seedTracks.slice(0, 5).join(','),
        limit
      }
    });
    return response.data.tracks;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

export const spotifyAPI = new SpotifyAPI();
