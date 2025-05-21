import { ipcMain, dialog } from 'electron';
import { join, isAbsolute, normalize } from 'path';
import fs from 'fs/promises';
import { DirectorySelectionResponse, WorldImportParams, WorldValidationResponse, IPC_CHANNELS } from '../../shared/types';

export function registerWorldHandlers() {
  // Handle directory selection
  ipcMain.handle(IPC_CHANNELS.PICK_DIRECTORY, async (): Promise<DirectorySelectionResponse> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Minecraft World Folder',
      // Security: Prevent directory traversal by normalizing path
      defaultPath: normalize(process.cwd())
    });
    
    if (canceled || !filePaths[0]) return null;
    
    // Security: Ensure the path is absolute and normalized
    const selectedPath = normalize(filePaths[0]);
    if (!isAbsolute(selectedPath)) return null;
    
    return selectedPath;
  });

  // Handle world import
  ipcMain.handle(IPC_CHANNELS.IMPORT_WORLD, async (_event, params: WorldImportParams): Promise<WorldValidationResponse> => {
    try {
      // Security: Validate and normalize input path
      if (!params?.sourcePath || typeof params.sourcePath !== 'string') {
        return {
          success: false,
          message: 'Invalid source path provided'
        };
      }

      const sourcePath = normalize(params.sourcePath);
      if (!isAbsolute(sourcePath)) {
        return {
          success: false,
          message: 'Source path must be absolute'
        };
      }

      // --- Validation: Check if it's a valid Minecraft world folder ---
      const levelDatPath = join(sourcePath, 'level.dat');
      const regionDirPath = join(sourcePath, 'region');
      const dataDirPath = join(sourcePath, 'data');

      let isWorld = true;
      let missingElements: string[] = [];

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

      return { 
        success: true, 
        message: 'World folder validated.',
        worldPath: sourcePath 
      };

    } catch (error) {
      console.error('World validation failed:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });
} 