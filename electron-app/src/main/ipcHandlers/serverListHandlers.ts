import { ipcMain, app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { IPC_CHANNELS } from '../../shared/types';

const serverListPath = path.join(app.getPath('userData'), 'servers.json');

// Helper to read the server list
async function readServerList() {
  try {
    const data = await fs.readFile(serverListPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Helper to write the server list
async function writeServerList(list: any[]) {
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
    if (list.length >= 4) throw new Error('Maximum 4 servers allowed');
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
} 