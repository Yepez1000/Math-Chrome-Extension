import React, { useEffect } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { SetupWizard } from "@/components/setup-wizard/setup-wizard";
import DashboardPage from "@/app/dashboard/page";
import ServerStartupPage from "@/app/server-startup/page";
import { Toaster } from "@/components/ui/toaster";
import { usePerformanceSettingsStore } from "@/stores/step-stores";

function App(): React.JSX.Element {
  const { setSystemInfo } = usePerformanceSettingsStore();

  // Initialize app with IPC test and system info
  useEffect(() => {
    console.log('App useEffect triggered. Dependencies:', { setSystemInfo });
    
    const initApp = async () => {
      console.log('=== App Initialization Start ===');
      
      // Test basic IPC communication first
      try {
        console.log('Testing IPC communication...');
        const testResult = window.electronAPI.test();
        console.log('IPC test successful:', testResult);
      } catch (error) {
        console.error('IPC test failed:', error);
        return; // Don't proceed if IPC test fails
      }

      // Get system info only if IPC test succeeds
      try {
        if (!window.electronAPI?.getSystemInfo) {
          console.error('getSystemInfo is not available on window.electronAPI!');
          console.log('Available APIs:', Object.keys(window.electronAPI || {}));
          return;
        }
        console.log('Calling getSystemInfo...');
        const info = await window.electronAPI.getSystemInfo();
        console.log('System info received:', info);
        setSystemInfo(info);
        console.log('System info set in store');
      } catch (error) {
        console.error('Error getting system info:', error);
      }
      
      console.log('=== App Initialization Complete ===');
    };

    initApp();
    
    // Cleanup function
    return () => {
      console.log('App useEffect cleanup running');
    };
  }, [setSystemInfo]);

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
