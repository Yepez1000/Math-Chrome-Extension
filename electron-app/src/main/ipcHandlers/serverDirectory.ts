import { ipcMain, dialog, app } from 'electron';
import { join, isAbsolute, normalize } from 'path';
import { DirectorySelectionResponse, IPC_CHANNELS } from '../../shared/types';

export function registerServerDirectoryHandler() {
  ipcMain.handle(IPC_CHANNELS.SELECT_SERVER_DIRECTORY, async (): Promise<DirectorySelectionResponse> => {
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
}
