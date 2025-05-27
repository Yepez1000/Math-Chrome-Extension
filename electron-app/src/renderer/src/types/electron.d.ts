import { SystemInfo, WorldImportParams, WorldValidationResponse } from '@shared/types'

declare global {
interface Window {
  electronAPI: {
      getTempDir: () => Promise<string>
      writeTempFile: (path: string, data: string) => Promise<void>
      pickDirectory: () => Promise<string | null>
      importWorld: (params: WorldImportParams) => Promise<WorldValidationResponse>
      getSystemInfo: () => Promise<SystemInfo>
      test: () => string
  }
  }
}

export {} 