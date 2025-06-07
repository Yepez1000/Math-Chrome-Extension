import { ipcMain, dialog } from 'electron'
import { registerServerDirectoryHandler } from './serverDirectory';
import { registerWorldHandlers } from './worldHandlers';
import { registerSystemInfoHandler } from './systemInfo';
import { registerPlayitHandlers } from './playitHandlers';
import { registerMinecraftHandlers } from './minecraftHandlers';
// Import clipboard handlers
import { registerClipboardHandlers } from './clipboardHandlers';
import { registerJavaHandlers } from './javaHandlers';

// Modify to not expect mainWindow
export function registerAllIpcHandlers(/* mainWindow: BrowserWindow */) {
  registerServerDirectoryHandler();
  registerWorldHandlers();
  registerSystemInfoHandler();
  // Call registerPlayitHandlers without arguments
  registerPlayitHandlers();
  // Register Minecraft handlers
  registerMinecraftHandlers();
  // Register clipboard handlers
  registerClipboardHandlers();
  registerJavaHandlers();
}

ipcMain.handle('show-prompt', async (_, title: string, defaultValue: string) => {
  const result = await dialog.showMessageBox({
    type: 'question',
    title,
    message: 'Enter world name:',
    defaultId: 0,
    buttons: ['OK', 'Cancel'],
    detail: defaultValue
  })
  return result.response === 0 ? defaultValue : null
})
