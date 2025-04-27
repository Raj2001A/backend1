/**
 * Logger utility for consistent logging across the application
 */

// Log levels
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

// Log entry interface
interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: any; // Additional context data
}

// Format the log entry as a string
const formatLogEntry = (entry: LogEntry): string => {
  const { level, message, timestamp, ...context } = entry;
  
  // Basic log format
  let logString = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
  
  // Add context if available
  if (Object.keys(context).length > 0) {
    try {
      const contextStr = JSON.stringify(context, (key, value) => {
        // Handle circular references and functions
        if (typeof value === 'function') {
          return '[Function]';
        }
        if (value === undefined) {
          return 'undefined';
        }
        return value;
      }, 2);
      
      logString += `\nContext: ${contextStr}`;
    } catch (err) {
      logString += '\nContext: [Error serializing context]';
    }
  }
  
  return logString;
};

// Logger implementation
class Logger {
  private level: LogLevel;
  
  constructor() {
    // Set log level based on environment
    this.level = (process.env.LOG_LEVEL as LogLevel) || 
      (process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG);
  }
  
  // Check if the given log level should be logged
  private shouldLog(level: LogLevel): boolean {
    const levels = Object.values(LogLevel);
    const currentLevelIndex = levels.indexOf(this.level);
    const targetLevelIndex = levels.indexOf(level);
    
    return targetLevelIndex <= currentLevelIndex;
  }
  
  // Create a log entry
  private createLogEntry(level: LogLevel, message: string | object, context?: object): LogEntry {
    // Handle object messages
    const msgString = typeof message === 'object' 
      ? JSON.stringify(message)
      : message;
    
    return {
      level,
      message: msgString,
      timestamp: new Date().toISOString(),
      ...(context || {})
    };
  }
  
  // Log a message
  private log(level: LogLevel, message: string | object, context?: object): void {
    if (!this.shouldLog(level)) {
      return;
    }
    
    const entry = this.createLogEntry(level, message, context);
    const formattedLog = formatLogEntry(entry);
    
    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedLog);
        break;
      case LogLevel.WARN:
        console.warn(formattedLog);
        break;
      case LogLevel.INFO:
        console.info(formattedLog);
        break;
      case LogLevel.DEBUG:
        console.debug(formattedLog);
        break;
    }
    
    // Here you could add additional logging targets like file logging or external services
  }
  
  // Public logging methods
  error(message: string | object, context?: object): void {
    this.log(LogLevel.ERROR, message, context);
  }
  
  warn(message: string | object, context?: object): void {
    this.log(LogLevel.WARN, message, context);
  }
  
  info(message: string | object, context?: object): void {
    this.log(LogLevel.INFO, message, context);
  }
  
  debug(message: string | object, context?: object): void {
    this.log(LogLevel.DEBUG, message, context);
  }
  
  // Set log level
  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

// Export a singleton instance
export const logger = new Logger();

// Export default for convenience
export default logger;
