import { ipcMain, app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { IPC_CHANNELS } from '../../shared/types';
import { startExistingServer, stopExistingServer } from '../services/serverService';
import { devLog, devError } from '../utils/logger';

const serverListPath = path.join(app.getPath('userData'), 'servers.json');

// Helper to read the server list
export async function readServerList() {
  try {
    const data = await fs.readFile(serverListPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Helper to write the server list
export async function writeServerList(list: any[]): Promise<void> {
  await fs.writeFile(serverListPath, JSON.stringify(list, null, 2));
}

export function registerServerListHandlers() {
  // IPC: Get server list
  ipcMain.handle(IPC_CHANNELS.GET_SERVER_LIST, async () => {
    return await readServerList();
  });

  // IPC: Add server
  ipcMain.handle(IPC_CHANNELS.ADD_SERVER, async (_event, server) => {
    const list = await readServerList();
    list.push(server);
    await writeServerList(list);
    return list;
  });

  // IPC: Remove server (by serverPath)
  ipcMain.handle(IPC_CHANNELS.REMOVE_SERVER, async (_event, serverPath) => {
    let list = await readServerList();
    list = list.filter((s: any) => s.serverPath !== serverPath);
    await writeServerList(list);
    // Delete the server directory from disk
    try {
      await fs.rm(serverPath, { recursive: true, force: true });
    } catch (err) {
      console.error("Failed to delete server directory:", err);
    }
    return list;
  });

  // IPC: Rename server
  ipcMain.handle(IPC_CHANNELS.RENAME_SERVER, async (_event, { serverId, newName }) => {
    const list = await readServerList();
    const updatedList = list.map((s: any) =>
      s.id === serverId ? { ...s, name: newName } : s
    );
    await writeServerList(updatedList);
    return updatedList;
  });

  // IPC: Update server
  ipcMain.handle(IPC_CHANNELS.UPDATE_SERVER, async (_, { serverId, updates }) => {
    const servers = await readServerList();
    const updatedServers = servers.map(server => 
      server.id === serverId ? { ...server, ...updates } : server
    );
    await writeServerList(updatedServers);
    return updatedServers;
  });

  // IPC: Start existing server
  ipcMain.handle(IPC_CHANNELS.START_EXISTING_SERVER, async (_, { serverId }) => {
    devLog(`Received start request for server: ${serverId}`);
    const servers = await readServerList();
    const server = servers.find(s => s.id === serverId);
    
    if (!server) {
      devError(`Server not found: ${serverId}`);
      return { success: false, error: 'Server not found' };
    }

    try {
      devLog(`Starting server with path: ${server.serverPath}, Java: ${server.javaPath}`);
      await startExistingServer(serverId, server.serverPath, server.javaPath);
      
      // Update only the specific server, but first verify its current status
      const updatedServers = servers.map(s => {
        if (s.id === serverId && s.status !== 'online') {
          devLog(`!!!Successfully updated status for server ${serverId} to online`);
          return { ...s, status: 'online', lastActive: Date.now(), onlinePlayers: s.onlinePlayers };
        }
        return s;  // Explicitly return unchanged for others
      });
      await writeServerList(updatedServers);
      devLog(`Successfully updated status for server ${serverId} to online`);
      return { success: true, servers: updatedServers };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      devError(`Start failed for ${serverId}: ${message}`);
      return { success: false, error: message };
    }
  });

  // IPC: Stop existing server
  ipcMain.handle(IPC_CHANNELS.STOP_EXISTING_SERVER, async (_, { serverId }) => {
    const result = await stopExistingServer(serverId);
    
    if (result.success) {
      // Only update server status after successful stop
      const servers = await readServerList();
      const updatedServers = servers.map(server => 
        server.id === serverId ? {...server, status: 'offline', lastActive: Date.now(), onlinePlayers: 0} : server
      );
      await writeServerList(updatedServers);
    }
    
    return result;
  });
} 