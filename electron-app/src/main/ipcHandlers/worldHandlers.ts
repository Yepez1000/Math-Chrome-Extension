import { ipcMain, dialog } from 'electron';
import { join } from 'path';
import fs from 'fs/promises';

export function registerWorldHandlers() {
  // Handle directory selection
  ipcMain.handle('pick-directory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Minecraft World Folder'
    });
    return canceled ? null : filePaths[0];
  });

  // Handle world import
  ipcMain.handle('import-world', async (_event, sourcePath: string, worldName: string) => {
    try {
      // Path to server.properties in the selected world folder
      const propsPath = join(sourcePath, 'server.properties');

      // Try to read and update, or create if missing
      let props = '';
      try {
        props = await fs.readFile(propsPath, 'utf8');
        // Update level-name if it exists
        if (/^level-name=/m.test(props)) {
          props = props.replace(/^level-name=.*/m, `level-name=${worldName}`);
        } else {
          props += `\nlevel-name=${worldName}\n`;
        }
      } catch {
        // If file doesn't exist, create it
        props = `level-name=${worldName}\n`;
      }
      await fs.writeFile(propsPath, props);

      return { success: true, message: 'World imported successfully!' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  });
} 