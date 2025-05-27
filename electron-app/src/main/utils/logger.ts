/**
 * Development-only logging utilities for the main process
 * These functions only output in development mode to keep production builds clean
 */

// Helper for dev-only logging
export const devLog = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
};

// Helper for dev-only error logging
export const devError = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.error(...args);
  }
};

// Helper for dev-only warning logging
export const devWarn = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.warn(...args);
  }
};

// Helper for dev-only debug logging with timestamp
export const devDebug = (...args: any[]) => {
  if (import.meta.env.DEV) {
    const timestamp = new Date().toISOString();
    console.log(`[DEBUG ${timestamp}]`, ...args);
  }
}; 