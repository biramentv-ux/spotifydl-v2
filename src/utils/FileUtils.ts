import fs from 'fs/promises';
import path from 'path';
import { logger } from '../core/Logger';

export class FileUtils {
  static async ensureDir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  static sanitizeFileName(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200);
  }

  static formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
  }

  static async getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          totalSize += await this.getDirectorySize(fullPath);
        } else {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
        }
      }
    } catch (error) {
      logger.warn(`Failed to calculate directory size: ${dirPath}`);
    }
    
    return totalSize;
  }

  static async cleanOldFiles(dirPath: string, maxAgeMs: number): Promise<number> {
    let cleaned = 0;
    const now = Date.now();
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        
        const fullPath = path.join(dirPath, entry.name);
        const stats = await fs.stat(fullPath);
        
        if (now - stats.mtime.getTime() > maxAgeMs) {
          await fs.unlink(fullPath);
          cleaned++;
        }
      }
    } catch (error) {
      logger.warn(`Failed to clean old files: ${dirPath}`);
    }
    
    return cleaned;
  }

  static getExtension(fileName: string): string {
    return path.extname(fileName).toLowerCase();
  }

  static async copyFile(src: string, dest: string): Promise<void> {
    await this.ensureDir(path.dirname(dest));
    await fs.copyFile(src, dest);
  }

  static async moveFile(src: string, dest: string): Promise<void> {
    await this.ensureDir(path.dirname(dest));
    await fs.rename(src, dest);
  }
}
