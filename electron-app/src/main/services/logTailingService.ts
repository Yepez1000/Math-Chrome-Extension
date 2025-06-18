import fs from 'fs';
import path from 'path';
import chokidar, { FSWatcher } from 'chokidar';
import { devLog, devError } from '../utils/logger';
import { sendToRenderer } from './serverService';
import { IPC_CHANNELS } from '../../shared/types';
import { ipcMain } from 'electron';
import { readServerList } from '../ipcHandlers/serverListHandlers';

const MAX_LOG_LINES = 200;

// Map to store active file watchers and their last read positions
const activeWatchers = new Map<string, { watcher: FSWatcher; lastSize: number }>();

/**
 * Reads new content from a file since the last known size.
 * @param serverId - The ID of the server.
 * @param filePath - The path to the log file.
 * @param lastSize - The last known size of the file.
 * @returns The new size of the file.
 */
function readNewContent(serverId: string, filePath: string, lastSize: number): number {
  try {
    const stats = fs.statSync(filePath);
    const newSize = stats.size;

    if (newSize > lastSize) {
      const stream = fs.createReadStream(filePath, { start: lastSize, end: newSize - 1, encoding: 'utf-8' });
      stream.on('data', (data) => {
        sendToRenderer(IPC_CHANNELS.SERVER_CONSOLE_OUTPUT, { serverId, message: data.toString() });
      });
      stream.on('error', (err) => {
        devError(`Error reading log file for server ${serverId}:`, err);
      });
    } else if (newSize < lastSize) {
      // Log file was likely rotated or cleared, read from the beginning
      const stream = fs.createReadStream(filePath, { start: 0, end: newSize - 1, encoding: 'utf-8' });
       stream.on('data', (data) => {
        sendToRenderer(IPC_CHANNELS.SERVER_CONSOLE_OUTPUT, { serverId, message: data.toString() });
      });
      stream.on('error', (err) => {
        devError(`Error reading rotated log file for server ${serverId}:`, err);
      });
    }
    return newSize;
  } catch (error) {
    devError(`Failed to stat log file for server ${serverId}:`, error);
    return lastSize; // Return original size on error
  }
}

/**
 * Starts tailing a log file for a specific server.
 * If a watcher already exists for the serverId, it will be stopped and replaced.
 * @param serverId - The unique identifier for the server.
 * @param serverDirectory - The base directory of the server.
 */
export function startTailingLog(serverId: string, serverDirectory: string): void {
  // Stop any existing watcher for this server first
  if (activeWatchers.has(serverId)) {
    stopTailingLog(serverId);
  }

  const logPath = path.join(serverDirectory, 'logs', 'latest.log');
  devLog(`[LogTailingService] Starting to watch log file for server ${serverId} at: ${logPath}`);

  // Ensure the log file exists before watching, chokidar handles this but we can be explicit
  if (!fs.existsSync(logPath)) {
    devLog(`[LogTailingService] Log file not found yet for ${serverId}. Will watch for its creation.`);
  }

  let lastSize = 0;
  try {
    const stats = fs.statSync(logPath);
    lastSize = stats.size;
  } catch {
    // File doesn't exist yet, lastSize remains 0
  }

  const watcher = chokidar.watch(logPath, {
    persistent: true,
    ignoreInitial: true, // Don't trigger on initial 'add' event
    usePolling: true, // More reliable on some systems
    interval: 300,
  });

  const onChange = () => {
    lastSize = readNewContent(serverId, logPath, lastSize);
  };
  
  const onAdd = () => {
    devLog(`[LogTailingService] Log file created for ${serverId}. Starting to read.`);
    lastSize = readNewContent(serverId, logPath, 0);
  };

  watcher.on('change', onChange);
  watcher.on('add', onAdd); // Handle case where log file is created after server starts

  watcher.on('error', (error) => {
    devError(`[LogTailingService] Watcher error for server ${serverId}:`, error);
  });

  activeWatchers.set(serverId, { watcher, lastSize });
  
  // Also read any initial content
  readNewContent(serverId, logPath, 0);
}

/**
 * Stops tailing a log file for a specific server.
 * @param serverId - The unique identifier for the server.
 */
export function stopTailingLog(serverId: string): void {
  const watcherInfo = activeWatchers.get(serverId);
  if (watcherInfo) {
    watcherInfo.watcher.close();
    activeWatchers.delete(serverId);
    devLog(`[LogTailingService] Stopped watching log file for server ${serverId}`);
  }
}

/**
 * Stops all active log file watchers.
 * Useful for application shutdown.
 */
export function stopAllTailing(): void {
  devLog('[LogTailingService] Stopping all log watchers...');
  for (const serverId of activeWatchers.keys()) {
    stopTailingLog(serverId);
  }
  devLog('[LogTailingService] All log watchers stopped.');
}

export function registerLogTailingHandlers() {
  ipcMain.handle(IPC_CHANNELS.GET_LOG_CONTENT, async (_, serverId: string) => {
    if (!serverId) {
      return { success: false, error: 'No server ID provided', content: [] };
    }

    try {
      const servers = await readServerList();
      const server = servers.find((s: any) => s.id === serverId);

      if (!server) {
        return { success: false, error: `Server with ID ${serverId} not found`, content: [] };
      }

      const logPath = path.join(server.serverPath, 'logs', 'latest.log');
      
      if (!fs.existsSync(logPath)) {
        return { success: true, content: [] }; // No log file yet, not an error
      }

      const fileContent = await fs.promises.readFile(logPath, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim());
      const lastLines = lines.slice(-MAX_LOG_LINES);

      return { success: true, content: lastLines };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      devError(`Failed to read log content for server ${serverId}:`, error);
      return { success: false, error: errorMessage, content: [] };
    }
  });
} 