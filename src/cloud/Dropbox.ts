import { Dropbox as DropboxSDK } from 'dropbox';
import { createReadStream } from 'fs';
import { logger } from '../core/Logger';

export class Dropbox {
  private dbx: DropboxSDK;

  constructor(config: { accessToken: string }) {
    this.dbx = new DropboxSDK({ accessToken: config.accessToken });
  }

  async upload(filePath: string, targetPath?: string): Promise<{ fileId: string; url: string }> {
    const fileName = filePath.split('/').pop() || 'unknown';
    const dropboxPath = targetPath || `/SpotifyDL/${fileName}`;

    const fileContent = createReadStream(filePath);
    const chunks: Buffer[] = [];

    for await (const chunk of fileContent) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);

    const response = await this.dbx.filesUpload({
      path: dropboxPath,
      contents: buffer,
      mode: { '.tag': 'overwrite' } as any
    });

    // Create shared link
    const linkResponse = await this.dbx.sharingCreateSharedLinkWithSettings({
      path: dropboxPath
    });

    return {
      fileId: response.result.id,
      url: linkResponse.result.url
    };
  }

  async createFolder(path: string): Promise<void> {
    await this.dbx.filesCreateFolderV2({
      path,
      autorename: false
    });
  }

  async listFiles(path: string = ''): Promise<any[]> {
    const response = await this.dbx.filesListFolder({ path });
    return response.result.entries;
  }

  async deleteFile(path: string): Promise<void> {
    await this.dbx.filesDeleteV2({ path });
    logger.debug(`Deleted from Dropbox: ${path}`);
  }

  async getSpaceUsage(): Promise<{ used: number; allocated: number }> {
    const response = await this.dbx.usersGetSpaceUsage();
    return {
      used: response.result.used,
      allocated: (response.result.allocation as any).individual?.allocated || 0
    };
  }
}
