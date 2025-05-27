import React, { useEffect } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { SetupWizard } from "@/components/setup-wizard/setup-wizard";
import DashboardPage from "@/app/dashboard/page";
import ServerStartupPage from "@/app/server-startup/page";
import { Toaster } from "@/components/ui/toaster";
import { usePerformanceSettingsStore } from "@/stores/step-stores";

// Helper for dev-only logging
const devLog = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
};

const devError = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.error(...args);
  }
};

function App(): React.JSX.Element {
  const { setSystemInfo } = usePerformanceSettingsStore();

  // Initialize app with system info - runs once on mount
  useEffect(() => {
    const initializeSystemInfo = async () => {
      devLog('=== App Initialization Start ===');
      
      // Test basic IPC communication first
      try {
        devLog('Testing IPC communication...');
        const testResult = window.electronAPI.test();
        devLog('IPC test successful:', testResult);
      } catch (error) {
        devError('IPC test failed:', error);
        return; // Early return - don't proceed if IPC test fails
      }

      // Get system info only if IPC test succeeds
      if (!window.electronAPI?.getSystemInfo) {
        devError('getSystemInfo is not available on window.electronAPI!');
        devLog('Available APIs:', Object.keys(window.electronAPI || {}));
        return;
      }

      try {
        devLog('Calling getSystemInfo...');
        const systemInfo = await window.electronAPI.getSystemInfo();
        devLog('System info received:', systemInfo);
        setSystemInfo(systemInfo);
        devLog('System info set in store');
      } catch (error) {
        devError('Error getting system info:', error);
      }
      
      devLog('=== App Initialization Complete ===');
    };

    initializeSystemInfo();
  }, []); // Empty dependency array - setSystemInfo is stable from Zustand

  return (
    <>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<SetupWizard />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/server-startup" element={<ServerStartupPage />} />
        </Routes>
      </MemoryRouter>
      <Toaster />
    </>
  );
}

export default App
