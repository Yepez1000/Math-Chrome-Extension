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
      // Catch any other errors during the process
      console.error('Import process failed:', error);
      return { success: false, message: `Import failed: ${error.message}` };
    }
  });
} 