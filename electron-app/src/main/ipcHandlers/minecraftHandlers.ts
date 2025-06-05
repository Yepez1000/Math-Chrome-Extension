import { ipcMain } from 'electron';
import { join } from 'path';
import fs from 'fs/promises';
import { IPC_CHANNELS } from '../../shared/types';
import { devLog, devError } from '../utils/logger';

export function registerMinecraftHandlers() {
  // Handle EULA acceptance
  ipcMain.handle(IPC_CHANNELS.ACCEPT_EULA, async (_event, serverDirectory: string) => {
    try {
      // Validate server directory
      if (!serverDirectory || typeof serverDirectory !== 'string') {
        throw new Error('Invalid server directory provided');
      }

      // Ensure the server directory exists
      await fs.mkdir(serverDirectory, { recursive: true });
      devLog(`Ensured server directory exists: ${serverDirectory}`);

      // Path to eula.txt
      const eulaPath = join(serverDirectory, 'eula.txt');

      // Check if eula.txt already exists
      try {
        await fs.access(eulaPath);
        devLog('EULA file already exists, checking content...');
        
        // Read existing content
        const content = await fs.readFile(eulaPath, 'utf-8');
        if (content.includes('eula=true')) {
          devLog('EULA already accepted');
          return { success: true, message: 'EULA already accepted' };
        }
      } catch (error) {
        // File doesn't exist, we'll create it
        devLog('EULA file does not exist, creating new one...');
      }

      // Create or update eula.txt with acceptance
      const eulaContent = `#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://account.mojang.com/documents/minecraft_eula).
#Generated for Minecraft Server
eula=true
`;
      
      await fs.writeFile(eulaPath, eulaContent, 'utf-8');
      devLog('EULA accepted successfully');

      return { 
        success: true, 
        message: 'EULA accepted successfully' 
      };

    } catch (error) {
      devError('Failed to accept EULA:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to accept EULA' 
      };
    }
  });
} 