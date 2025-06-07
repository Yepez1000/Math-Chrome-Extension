import { ipcMain } from 'electron';
import { join } from 'path';
import fs from 'fs/promises';
import { IPC_CHANNELS } from '../../shared/types';
import { devLog, devError } from '../utils/logger';
import { execAsync } from '../utils/execAsync';

interface JavaVersion {
  path: string;
  version: string;
  majorVersion: number;
}

export function registerJavaHandlers() {
  // Handle detecting Java version
  ipcMain.handle(IPC_CHANNELS.JAVA_DETECT_VERSION, async () => {
    try {
      devLog('Checking Java installations for Minecraft server...');
      devLog('Minecraft server requires Java 17 or higher');

      // Common Java installation paths
      const commonJavaPaths = [
        'C:\\Program Files\\Eclipse Adoptium',
        'C:\\Program Files\\Java',
        'C:\\Program Files (x86)\\Java',
        process.env.JAVA_HOME || '',
        process.env.PROGRAMFILES || '',
        process.env['PROGRAMFILES(X86)'] || ''
      ].filter(Boolean);

      let bestJavaVersion: JavaVersion | null = null;

      // Search for Java installations
      for (const basePath of commonJavaPaths) {
        try {
          const entries = await fs.readdir(basePath, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory() && entry.name.toLowerCase().includes('jdk')) {
              const javaPath = join(basePath, entry.name, 'bin', 'java.exe');
              try {
                await fs.access(javaPath);
                const { stderr } = await execAsync(`"${javaPath}" -version`);
                const versionMatch = stderr.match(/version "([^"]+)"/);
                if (versionMatch) {
                  const version = versionMatch[1];
                  const majorVersion = parseInt(version.split('.')[0]);
                  
                  // Update best version if this one is better
                  if (majorVersion >= 17 && (!bestJavaVersion || majorVersion > bestJavaVersion.majorVersion)) {
                    bestJavaVersion = {
                      path: javaPath,
                      version: version,
                      majorVersion: majorVersion
                    };
                  }
                }
              } catch (error) {
                // Skip if java.exe not found or version check fails
                continue;
              }
            }
          }
        } catch (error) {
          // Skip if directory not found or not accessible
          continue;
        }
      }

      if (!bestJavaVersion) {
        return {
          javaStatus: 'unsupported',
          javaVersion: 'none',
          javaPath: undefined,
          message: 'Java 17 or higher is required for the Minecraft server. Please install Java 17 or higher from adoptium.net'
        };
      }
      if (bestJavaVersion.majorVersion < 17) {
        return {
          javaStatus: 'unsupported',
          javaVersion: bestJavaVersion.version,
          javaPath: bestJavaVersion.path,
          message: 'Java 17 or higher is required for the Minecraft server. Please install Java 17 or higher from adoptium.net'
        };
      }

      devLog(`Using Java ${bestJavaVersion.version} from ${bestJavaVersion.path}`);
      return { 
        javaStatus: 'supported', 
        javaVersion: bestJavaVersion.version,
        javaPath: bestJavaVersion.path,
        message: 'Compatible Java version found!'
      };

    } catch (error) {
      devError('Failed during Java detection:', error);
      return { 
        javaStatus: 'error',
        javaVersion: null,
        error: error instanceof Error ? error.message : 'Unknown detection error',
        message: 'Error checking Java installation'
      };
    }
  });
} 