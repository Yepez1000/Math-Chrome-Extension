import { ipcMain, clipboard } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import { devLog, devError } from '../utils/logger';

export function registerClipboardHandlers() {
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_WRITE, async (_event, text: string) => {
    devLog(`Received request to write to clipboard: "${text}"`);
    try {
      clipboard.writeText(text);
      devLog('Successfully wrote to clipboard.');
      return { success: true };
    } catch (error) {
      devError(`Failed to write to clipboard: ${error}`);
      return { success: false, message: 'Failed to write to clipboard' };
    }
  });
} 