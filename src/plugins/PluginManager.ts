import fs from 'fs/promises';
import path from 'path';
import { logger } from '../core/Logger';
import { eventBus } from '../core/EventBus';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  entry: string;
  permissions: string[];
  hooks: string[];
}

export interface LoadedPlugin {
  manifest: PluginManifest;
  enabled: boolean;
  exports: any;
}

export class PluginManager {
  private plugins: Map<string, LoadedPlugin> = new Map();
  private pluginDir: string;
  private timeout: number;
  private allowedPermissions = [
    'download:pre',
    'download:post',
    'metadata:modify',
    'ui:render',
    'notification:send'
  ];

  constructor(pluginDir: string = './plugins', timeout: number = 5000) {
    this.pluginDir = pluginDir;
    this.timeout = timeout;
  }

  async loadPlugins(): Promise<void> {
    try {
      const entries = await fs.readdir(this.pluginDir, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory());

      for (const dir of dirs) {
        await this.loadPlugin(path.join(this.pluginDir, dir.name));
      }

      logger.info(`📦 Loaded ${this.plugins.size} plugins`);
    } catch (error) {
      logger.warn('Plugin directory not found, creating...');
      await fs.mkdir(this.pluginDir, { recursive: true });
    }
  }

  async loadPlugin(pluginPath: string): Promise<void> {
    try {
      const manifestPath = path.join(pluginPath, 'manifest.json');
      const manifestData = await fs.readFile(manifestPath, 'utf-8');
      const manifest: PluginManifest = JSON.parse(manifestData);

      this.validateManifest(manifest);

      const entryPath = path.join(pluginPath, manifest.entry);
      const code = await fs.readFile(entryPath, 'utf-8');

      // Simple sandbox using Function constructor instead of vm2
      const sandbox = {
        console: {
          log: (...args: any[]) => logger.debug(`[Plugin ${manifest.id}]`, ...args),
          error: (...args: any[]) => logger.error(`[Plugin ${manifest.id}]`, ...args)
        },
        setTimeout: (fn: (...args: any[]) => void, ms: number) => setTimeout(fn, Math.min(ms, this.timeout)),
        Buffer,
        JSON,
        Math,
        Date
      };

      const exports: any = {};
      const fn = new Function('exports', 'console', 'setTimeout', 'Buffer', 'JSON', 'Math', 'Date', code);
      fn(exports, sandbox.console, sandbox.setTimeout, sandbox.Buffer, sandbox.JSON, sandbox.Math, sandbox.Date);

      const plugin: LoadedPlugin = {
        manifest,
        enabled: true,
        exports
      };

      this.plugins.set(manifest.id, plugin);

      eventBus.emit('plugin:lifecycle', {
        pluginId: manifest.id,
        type: 'loaded'
      });

      logger.info(`🔌 Plugin loaded: ${manifest.name} v${manifest.version}`);
    } catch (error) {
      logger.error(`Failed to load plugin from ${pluginPath}`, { error });
      eventBus.emit('plugin:lifecycle', {
        pluginId: path.basename(pluginPath),
        type: 'error',
        error: error as Error
      });
    }
  }

  private validateManifest(manifest: PluginManifest): void {
    const required = ['id', 'name', 'version', 'entry'];
    for (const field of required) {
      if (!manifest[field as keyof PluginManifest]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (manifest.permissions) {
      for (const perm of manifest.permissions) {
        if (!this.allowedPermissions.includes(perm)) {
          throw new Error(`Invalid permission: ${perm}`);
        }
      }
    }
  }

  enablePlugin(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.enabled = true;
      eventBus.emit('plugin:lifecycle', { pluginId, type: 'enabled' });
      logger.info(`✅ Plugin enabled: ${pluginId}`);
      return true;
    }
    return false;
  }

  disablePlugin(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.enabled = false;
      eventBus.emit('plugin:lifecycle', { pluginId, type: 'disabled' });
      logger.info(`⛔ Plugin disabled: ${pluginId}`);
      return true;
    }
    return false;
  }

  getPlugin(pluginId: string): LoadedPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  getAllPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values());
  }

  getEnabledPlugins(): LoadedPlugin[] {
    return this.getAllPlugins().filter(p => p.enabled);
  }

  executeHook(hookName: string, context: any): any[] {
    const results: any[] = [];
    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.manifest.hooks.includes(hookName) && plugin.exports[hookName]) {
        try {
          const result = plugin.exports[hookName](context);
          results.push(result);
        } catch (error) {
          logger.error(`Hook ${hookName} failed in plugin ${plugin.manifest.id}`, { error });
        }
      }
    }
    return results;
  }

  async unloadPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      this.plugins.delete(pluginId);
      logger.info(`🗑️ Plugin unloaded: ${pluginId}`);
    }
  }
}
