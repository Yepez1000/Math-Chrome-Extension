import { ipcMain } from 'electron'
import os from 'os'

export function registerSystemInfoHandler() {
  console.log('Registering system info handler...');
  
  ipcMain.handle('get-system-info', async () => {
    console.log('\n=== RAM Calculation Debug ===')
    try {
      // Get total system memory in bytes
      const totalMemory = os.totalmem()
      const totalMemoryGB = totalMemory / (1024 * 1024 * 1024)
      console.log(`1. Total RAM: ${totalMemory} bytes (${totalMemoryGB.toFixed(2)} GB)`)
      
      // Convert to MB
      const totalRamMB = Math.round(totalMemory / (1024 * 1024))
      console.log(`2. Total RAM in MB: ${totalRamMB} MB`)

      // OS-specific RAM calculations
      const platform = os.platform()
      console.log(`3. Detected Platform: ${platform}`)

      let availableRamMB: number;

      if (platform === 'darwin') {
        // macOS: Use percentage-based calculation due to memory compression
        const usablePercentage = 0.75
        const usableRamMB = Math.round(totalRamMB * usablePercentage)
        console.log(`\n4. macOS RAM Calculation:`)
        console.log(`   - Usable percentage: ${usablePercentage * 100}%`)
        console.log(`   - Usable RAM: ${usableRamMB} MB`)
        
        const safetyBufferPercentage = 0.1
        const safetyBufferMB = Math.round(totalRamMB * safetyBufferPercentage)
        console.log(`   - Safety buffer: ${safetyBufferPercentage * 100}%`)
        console.log(`   - Buffer amount: ${safetyBufferMB} MB`)
        
        availableRamMB = Math.max(512, usableRamMB - safetyBufferMB)
      } else {
        // Windows/Linux: Use free memory + cached memory approach
        const freeMemory = os.freemem()
        const freeMemoryMB = Math.round(freeMemory / (1024 * 1024))
        
        // On Windows, we can be more aggressive with available memory
        // since Windows has good memory management
        const systemReservePercentage = platform === 'win32' ? 0.15 : 0.2
        const systemReserveMB = Math.round(totalRamMB * systemReservePercentage)
        
        console.log(`\n4. Windows/Linux RAM Calculation:`)
        console.log(`   - Free RAM: ${freeMemoryMB} MB`)
        console.log(`   - System reserve: ${systemReservePercentage * 100}%`)
        console.log(`   - Reserved amount: ${systemReserveMB} MB`)
        
        // For Windows/Linux, we'll use the larger of:
        // 1. Current free memory minus a small reserve
        // 2. 70% of total RAM minus reserve
        const minimumFree = Math.round(totalRamMB * 0.7) - systemReserveMB
        availableRamMB = Math.max(
          512,
          Math.max(
            freeMemoryMB - systemReserveMB,
            minimumFree
          )
        )
      }

      console.log(`\n5. Final Available RAM: ${availableRamMB} MB`)
      
      const result = {
        totalRam: totalRamMB,
        availableRam: availableRamMB,
        cpuCores: os.cpus().length
      };
      
      console.log('\n=== Final System Info ===')
      console.log(result)
      console.log('=== End RAM Calculation ===\n')
      
      return result;
    } catch (error) {
      console.error('Error in get-system-info handler:', error)
      throw error
    }
  })
  console.log('System info handler registered successfully');
} 