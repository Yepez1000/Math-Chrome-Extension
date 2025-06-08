import { ipcMain, dialog } from 'electron';
import { join, /*sep*/ } from 'path';
import fs from 'fs/promises';
import { IPC_CHANNELS } from '../../shared/types';
import { /*devLog, */devError } from '../utils/logger';
import { execAsync } from '../utils/execAsync';

interface JavaVersion {
  path: string;
  version: string;
  majorVersion: number;
}

// Recursively search for java.exe in a directory, up to a maximum depth
async function findJavaExecutables(dir: string, found: string[] = [], depth = 0, maxDepth = 4): Promise<string[]> {
  if (depth > maxDepth) return found;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await findJavaExecutables(fullPath, found, depth + 1, maxDepth);
      } else if (entry.isFile() && entry.name.toLowerCase() === 'java.exe') {
        found.push(fullPath);
      }
    }
  } catch (e) {
    // Ignore permission errors or missing directories
  }
  return found;
}

function parseJavaVersionOutput(output: string): { version: string, majorVersion: number } | null {
  // Try to match both "version \"17.0.8\"" and "version \"1.8.0_312\""
  const match = output.match(/version \"([\d._]+)\"/);
  if (!match) return null;
  const version = match[1];
  let majorVersion = 0;
  if (version.startsWith('1.')) {
    // e.g. 1.8.0_312 => 8
    majorVersion = parseInt(version.split('.')[1], 10);
  } else {
    // e.g. 17.0.8 => 17
    majorVersion = parseInt(version.split('.')[0], 10);
  }
  return { version, majorVersion };
}

export function registerJavaHandlers() {
  // Handle manual Java selection
  ipcMain.handle(IPC_CHANNELS.JAVA_SELECT_MANUAL, async () => {
    try {
      // Try to open at Eclipse Adoptium or Java folder
      const defaultPaths = [
        'C:\\Program Files\\Eclipse Adoptium',
        'C:\\Program Files\\Java',
        'C:\\Program Files (x86)\\Java',
      ];
      let defaultPath = defaultPaths.find(async (p) => {
        try { await fs.access(p); return true; } catch { return false; }
      }) || 'C:\\';

      const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile', 'openDirectory'],
        title: 'Select Java Executable or Folder',
        filters: [
          { name: 'Java Executable', extensions: ['exe'] }
        ],
        defaultPath
      });

      if (canceled || !filePaths[0]) {
        return { success: false, message: 'No Java executable or folder selected' };
      }

      let javaPath = filePaths[0];
      let stat;
      try {
        stat = await fs.stat(javaPath);
      } catch {
        return { success: false, message: 'Selected path is not accessible' };
      }
      if (stat.isDirectory()) {
        // Recursively search for java.exe in the selected folder
        const found = await findJavaExecutables(javaPath, [], 0, 4);
        if (found.length === 0) {
          return { success: false, message: 'No java.exe found in selected folder' };
        }
        javaPath = found[0]; // Use the first found
      }

      // Validate the selected Java executable
      try {
        const { stdout, stderr } = await execAsync(`"${javaPath}" -version`);
        const output = stdout + stderr;
        const parsed = parseJavaVersionOutput(output);
        if (!parsed) {
          return { success: false, message: 'Invalid Java executable' };
        }
        if (parsed.majorVersion < 17) {
          return { success: false, message: `Java version ${parsed.version} is not compatible. Java 17 or higher is required.` };
        }
        return {
          success: true,
          path: javaPath,
          version: parsed.version,
          majorVersion: parsed.majorVersion
        };
      } catch (error) {
        devError('Failed to validate Java executable:', error);
        return { success: false, message: 'Failed to validate Java executable' };
      }
    } catch (error) {
      devError('Error in manual Java selection:', error);
      return { success: false, message: 'Error selecting Java executable' };
    }
  });

  // Handle Java version detection
  ipcMain.handle(IPC_CHANNELS.JAVA_DETECT_VERSION, async (_event, manualJavaPath?: string) => {
    try {
      // If a manual Java path is provided, validate and use it
      if (manualJavaPath) {
        try {
          const { stdout, stderr } = await execAsync(`"${manualJavaPath}" -version`);
          const output = stdout + stderr;
          const parsed = parseJavaVersionOutput(output);
          if (!parsed) {
            return { success: false, message: 'Invalid Java executable' };
          }
          if (parsed.majorVersion < 17) {
            return { success: false, message: `Java version ${parsed.version} is not compatible. Java 17 or higher is required.` };
          }
          return {
            success: true,
            path: manualJavaPath,
            version: parsed.version,
            majorVersion: parsed.majorVersion
          };
        } catch (error) {
          devError('Failed to validate manual Java path:', error);
          return { success: false, message: 'Failed to validate Java executable' };
        }
      }

      // Otherwise, search for Java installations recursively
      const commonPaths = [
        'C:\\Program Files\\Eclipse Adoptium',
        'C:\\Program Files\\Java',
        'C:\\Program Files (x86)\\Java',
        process.env.JAVA_HOME,
        process.env.PROGRAMFILES,
        process.env['PROGRAMFILES(X86)']
      ].filter(Boolean) as string[];

      const javaExecutables: string[] = [];
      for (const basePath of commonPaths) {
        const found = await findJavaExecutables(basePath, [], 0, 4);
        javaExecutables.push(...found);
      }

      const javaVersions: JavaVersion[] = [];
      for (const javaPath of javaExecutables) {
        try {
          const { stdout, stderr } = await execAsync(`"${javaPath}" -version`);
          const output = stdout + stderr;
          const parsed = parseJavaVersionOutput(output);
          if (parsed && parsed.majorVersion >= 17) {
            javaVersions.push({ path: javaPath, version: parsed.version, majorVersion: parsed.majorVersion });
          }
        } catch {
          continue;
        }
      }

      if (javaVersions.length === 0) {
        return { success: false, message: 'No Java 17+ installations found' };
      }

      // Sort by major version (highest first)
      javaVersions.sort((a, b) => b.majorVersion - a.majorVersion);

      return {
        success: true,
        path: javaVersions[0].path,
        version: javaVersions[0].version,
        majorVersion: javaVersions[0].majorVersion
      };
    } catch (error) {
      devError('Error detecting Java version:', error);
      return { success: false, message: 'Error detecting Java version' };
    }
  });
} 