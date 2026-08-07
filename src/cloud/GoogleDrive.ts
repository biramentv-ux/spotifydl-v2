import { google } from 'googleapis';
import { createReadStream } from 'fs';
import { logger } from '../core/Logger';

export class GoogleDrive {
  private oauth2Client: any;
  private drive: any;

  constructor(config: { clientId: string; clientSecret: string; redirectUri: string }) {
    this.oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );

    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
  }

  setCredentials(tokens: { access_token: string; refresh_token?: string }): void {
    this.oauth2Client.setCredentials(tokens);
  }

  getAuthUrl(scopes: string[] = ['https://www.googleapis.com/auth/drive.file']): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes
    });
  }

  async exchangeCode(code: string): Promise<any> {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.setCredentials(tokens);
    return tokens;
  }

  async upload(filePath: string, folderId?: string): Promise<{ fileId: string; url: string }> {
    const fileName = filePath.split('/').pop() || 'unknown';

    const metadata: any = {
      name: fileName,
      mimeType: 'audio/mpeg'
    };

    if (folderId) {
      metadata.parents = [folderId];
    }

    const response = await this.drive.files.create({
      requestBody: metadata,
      media: {
        mimeType: 'audio/mpeg',
        body: createReadStream(filePath)
      },
      fields: 'id, webViewLink'
    });

    // Make file publicly readable
    await this.drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });

    return {
      fileId: response.data.id,
      url: response.data.webViewLink
    };
  }

  async createFolder(name: string, parentId?: string): Promise<string> {
    const metadata: any = {
      name,
      mimeType: 'application/vnd.google-apps.folder'
    };

    if (parentId) {
      metadata.parents = [parentId];
    }

    const response = await this.drive.files.create({
      requestBody: metadata,
      fields: 'id'
    });

    return response.data.id;
  }

  async listFiles(folderId?: string, query?: string): Promise<any[]> {
    const q = [
      "mimeType='audio/mpeg'",
      folderId ? `'${folderId}' in parents` : null,
      query || null
    ].filter(Boolean).join(' and ');

    const response = await this.drive.files.list({
      q,
      fields: 'files(id, name, size, createdTime, webViewLink)'
    });

    return response.data.files || [];
  }

  async deleteFile(fileId: string): Promise<void> {
    await this.drive.files.delete({ fileId });
    logger.debug(`Deleted from Google Drive: ${fileId}`);
  }
}
