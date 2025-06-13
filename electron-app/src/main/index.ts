import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerAllIpcHandlers } from './ipcHandlers'
import { stopExistingServer, activeProcesses } from './services/serverService'
import { devLog, devError } from './utils/logger'
import { readServerList, writeServerList } from './ipcHandlers/serverListHandlers'

declare global {
  namespace Electron {
    interface App {
      isQuiting: boolean;
    }
  }
}

// Initialize it before creating windows
app.isQuiting = false;

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('close', async (event) => {
    if (!app.isQuiting) {
      event.preventDefault();

      if (!mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('APP_CLOSING');

        await Promise.race([
          new Promise(resolve => ipcMain.once('APP_CLOSING_ACK', resolve)),
          new Promise(resolve => setTimeout(resolve, 1000))
        ]);
      }

      mainWindow.destroy();
    }
  });

  // Handle explicit app quitting (Ctrl+Q)
  app.on('before-quit', async (event) => {
    if (app.isQuiting) return;
    app.isQuiting = true;
    event.preventDefault();

    try {
      devLog('Initiating server shutdown sequence...');
      const serverIds = [...activeProcesses.keys()];
      devLog('Servers to stop:', serverIds);
      
      if (serverIds.length > 0) {  // Only proceed if there are servers to stop
        const stopPromises = serverIds.map(async (serverId) => {
          try {
            devLog(`Stopping server ${serverId}`);
            await stopExistingServer(serverId);
            devLog(`Successfully stopped server ${serverId}`);
            
            // Directly update server list for the stopped server
            const servers = await readServerList();
            const updatedServers = servers.map(server => 
              server.id === serverId ? { ...server, status: 'offline', lastActive: Date.now(), onlinePlayers: 0 } : server
            );
            await writeServerList(updatedServers);
            devLog(`Successfully updated status for server ${serverId} to offline`);
          } catch (err) {
            devError(`Failed to stop or update server ${serverId}: ${err instanceof Error ? err.message : String(err)}`);
          }
        });
        
        await Promise.allSettled(stopPromises);
        devLog('All server shutdown and status update attempts completed');
      } else {
        devLog('No servers to stop, skipping updates');
      }
    } catch (err) {
      devError('Error in shutdown sequence:', err);
    } finally {
      app.exit(0);
    }
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  registerAllIpcHandlers();
  
  createWindow();
  
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => {})

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.