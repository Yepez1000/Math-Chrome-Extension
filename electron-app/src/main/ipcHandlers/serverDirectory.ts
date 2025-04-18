import { ipcMain, dialog, app } from 'electron';
import path from 'path';

export function registerServerDirectoryHandler() {
  ipcMain.handle('select-server-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Server Folder',
      defaultPath: path.join(app.getPath('documents'), 'EasyCraftServers'),
    });
    if (result.canceled || !result.filePaths[0]) return null;

    const selectedPath = result.filePaths[0];
    // Validation: must be absolute, no traversal
    if (!path.isAbsolute(selectedPath)) return null;
    // Optionally: restrict to appData/EasyCraft
    // const easyCraftRoot = path.join(app.getPath('appData'), 'EasyCraft');
    // if (!selectedPath.startsWith(easyCraftRoot)) return null;
    return selectedPath;
  });
}
