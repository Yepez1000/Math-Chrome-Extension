import { registerServerDirectoryHandler } from './serverDirectory';

export function registerAllIpcHandlers() {
  registerServerDirectoryHandler();
}
