import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';

interface ServerConfig {
  serverDirectory: string | null;
}

// Initialize with a default configuration
let configCache: ServerConfig = {
  serverDirectory: null,
};

const configFileName = 'server-config.json';

async function getConfigPath(): Promise<string> {
  const userDataPath = app.getPath('userData');
  const appDataDir = path.join(userDataPath, 'EasyCraft'); // Use an app-specific subdirectory
  // Ensure the directory exists
  await fs.mkdir(appDataDir, { recursive: true }).catch(() => {}); // Ignore error if directory exists
  return path.join(appDataDir, configFileName);
}

export async function getServerConfig(): Promise<ServerConfig> {
  if (configCache.serverDirectory !== null) {
    return configCache; // Return cached config if available
  }

  const configPath = await getConfigPath();
  try {
    const configFileContent = await fs.readFile(configPath, 'utf-8');
    configCache = JSON.parse(configFileContent);
    return configCache;
  } catch (error: any) {
    // If file not found or parsing error, return default config
    console.error('Failed to read server config:', error);
    configCache = { serverDirectory: null }; // Reset cache to default on read failure
    return configCache;
  }
}

export async function setServerConfig(config: ServerConfig): Promise<void> {
  const configPath = await getConfigPath();
  try {
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    configCache = config; // Update cache after successful write
    console.log('Server config saved successfully.');
  } catch (error) {
    console.error('Failed to write server config:', error);
    // Decide how to handle write errors - maybe revert cache or leave as is
    // For now, we leave cache as is but log the error.
  }
} 