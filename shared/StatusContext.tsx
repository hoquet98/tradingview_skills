import React, { createContext, useContext, useState } from 'react';

interface StatusContextType {
  message: string;
  setMessage: (msg: string) => void;
}

const StatusContext = createContext<StatusContextType | undefined>(undefined);

export const StatusProvider = ({ children }: { children: React.ReactNode }) => {
  const [message, setMessage] = useState(''); // ✅ Place it here

  return <StatusContext.Provider value={{ message, setMessage }}>{children}</StatusContext.Provider>;
};

export const useStatus = (): StatusContextType => {
  const context = useContext(StatusContext);
  if (!context) throw new Error('useStatus must be used within a StatusProvider');
  return context;
};

export function useLoggedStatus() {
  const { setMessage } = useStatus();

  return (msg: string, level: 'info' | 'warn' | 'error' = 'info') => {
    const prefix = '[TV Strategy]';

    switch (level) {
      case 'warn':
        console.warn(`${prefix} ⚠️ ${msg}`);
        break;
      case 'error':
        console.error(`${prefix} ❌ ${msg}`);
        break;
      default:
        console.log(`${prefix} ${msg}`);
    }

    setMessage(msg);
  };
}
