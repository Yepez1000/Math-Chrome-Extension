import { ipcMain, dialog, app } from 'electron';
import { join, isAbsolute, normalize } from 'path';
import { DirectorySelectionResponse, IPC_CHANNELS } from '../../shared/types';
//import { devLog, devError } from '../utils/logger';

export function registerServerDirectoryHandler() {
  ipcMain.handle(IPC_CHANNELS.SERVER_DIRECTORY_SELECT, async (): Promise<DirectorySelectionResponse> => {
    const defaultServerPath = normalize(join(app.getPath('documents'), 'EasyCraftServers'));
    
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Server Folder',
      defaultPath: defaultServerPath,
    });

    if (result.canceled || !result.filePaths[0]) return null;

    const selectedPath = normalize(result.filePaths[0]);
    // Security: Ensure path is absolute
    if (!isAbsolute(selectedPath)) return null;

    return selectedPath;
  });

  // Handler to get the default server directory
  ipcMain.handle(IPC_CHANNELS.SERVER_DIRECTORY_DEFAULT, async (): Promise<string | null> => {
    try {
      const defaultServerPath = normalize(join(app.getPath('documents'), 'EasyCraftServers'));
      // Note: We are not creating the directory here, just returning the suggested path.
      // The application will create it later when needed.
      return defaultServerPath;
    } catch (error) {
      //devError('Failed to get default server directory:', error);
      console.error('Failed to get default server directory:', error);
      return null;
    }
  });
}
