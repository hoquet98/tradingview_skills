export function debugLog(level: 'log' | 'warn' | 'error' = 'log', message: string = '', data?: any) {
  try {
    const debugEnabled = localStorage.getItem('debugLogs') === 'true';
    if (!debugEnabled) return;

    const prefix = '🪵 [Shared-Script]';
    if (data !== undefined) {
      console[level](prefix, message, data);
    } else {
      console[level](prefix, message);
    }
  } catch (err) {
    // silently ignore if localStorage is not accessible
  }
}
