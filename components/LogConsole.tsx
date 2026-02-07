import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';
import { Terminal } from 'lucide-react';

interface LogConsoleProps {
  logs: LogEntry[];
}

const LogConsole: React.FC<LogConsoleProps> = ({ logs }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex flex-col h-64 bg-black border border-gray-700 rounded-lg font-mono text-sm shadow-inner">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800 bg-gray-900">
        <Terminal className="w-4 h-4 text-green-500" />
        <span className="text-gray-400 text-xs uppercase tracking-wider">System Logs</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {logs.length === 0 && (
          <div className="text-gray-600 italic text-xs">Waiting for system events...</div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="flex gap-3">
            <span className="text-gray-600 shrink-0 text-xs">[{log.timestamp}]</span>
            <div className="flex-1">
              <span className={`text-xs font-bold mr-2 px-1 rounded ${
                log.source === 'SYSTEM' ? 'bg-gray-800 text-gray-300' :
                log.source === 'VISION' ? 'bg-purple-900/50 text-purple-300' :
                'bg-blue-900/50 text-blue-300'
              }`}>
                {log.source}
              </span>
              <span className={`${
                log.level === 'alert' ? 'text-red-400 font-bold' :
                log.level === 'success' ? 'text-green-400' :
                'text-gray-300'
              }`}>
                {log.message}
              </span>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default LogConsole;