import { ipcMain, dialog } from 'electron'
import { registerServerDirectoryHandler } from './serverDirectory';
import { registerWorldHandlers } from './worldHandlers';

export function registerAllIpcHandlers() {
  registerServerDirectoryHandler();
  registerWorldHandlers();
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
