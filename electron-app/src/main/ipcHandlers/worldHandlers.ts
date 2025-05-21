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
  ipcMain.handle('import-world', async (_event, sourcePath: string) => {
    try {
      // --- Validation: Check if it's a valid Minecraft world folder ---

      const levelDatPath = join(sourcePath, 'level.dat');
      const regionDirPath = join(sourcePath, 'region');
      const dataDirPath = join(sourcePath, 'data');

      let isWorld = true;
      let missingElements: string[] = []; // Explicitly define as string array

      // Check for level.dat file
      try {
        await fs.access(levelDatPath);
      } catch {
        missingElements.push('level.dat');
        isWorld = false;
      }

      // Check for region directory
      try {
        const stats = await fs.stat(regionDirPath);
        if (!stats.isDirectory()) {
            missingElements.push('region (not a directory)');
            isWorld = false;
        }
      } catch {
        missingElements.push('region directory');
        isWorld = false;
      }

       // Check for data directory (often present, but region is more critical)
       // Making this check optional for broader compatibility
      try {
        const stats = await fs.stat(dataDirPath);
        if (!stats.isDirectory()) {
            missingElements.push('data (not a directory)');
            isWorld = false;
        }
      } catch {
        missingElements.push('data directory');
        isWorld = false;
      }


      if (!isWorld) {
        return {
          success: false,
          message: `Selected folder does not appear to be a valid Minecraft world. Missing: ${missingElements.join(', ')}.`
        };
      }

      // --- End Validation ---

      // If validation succeeds, return the path of the world folder
      return { success: true, message: 'World folder validated.', worldPath: sourcePath };

    } catch (error: any) {
      // Catch any other errors during the process
      console.error('World validation failed:', error);
      return { success: false, message: `Validation failed: ${error.message}` };
    }
  });
} 