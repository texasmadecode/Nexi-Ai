// Nexi Logging System - Structured logging with configurable levels

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  category: string;
  message: string;
  data?: Record<string, unknown>;
}

export type LogHandler = (entry: LogEntry) => void;

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4,
};

class Logger {
  private level: LogLevel = 'info';
  private handlers: LogHandler[] = [];
  private defaultHandler: LogHandler = (entry) => {
    const timestamp = entry.timestamp.toISOString();
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.category}]`;
    const dataStr = entry.data ? ' ' + JSON.stringify(entry.data) : '';

    switch (entry.level) {
      case 'debug':
        console.debug(`${prefix} ${entry.message}${dataStr}`);
        break;
      case 'info':
        console.info(`${prefix} ${entry.message}${dataStr}`);
        break;
      case 'warn':
        console.warn(`${prefix} ${entry.message}${dataStr}`);
        break;
      case 'error':
        console.error(`${prefix} ${entry.message}${dataStr}`);
        break;
    }
  };

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  addHandler(handler: LogHandler): void {
    this.handlers.push(handler);
  }

  removeHandler(handler: LogHandler): void {
    const index = this.handlers.indexOf(handler);
    if (index > -1) {
      this.handlers.splice(index, 1);
    }
  }

  clearHandlers(): void {
    this.handlers = [];
  }

  private log(
    level: LogLevel,
    category: string,
    message: string,
    data?: Record<string, unknown>
  ): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.level]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      category,
      message,
      data,
    };

    // Use custom handlers if any, otherwise use default
    if (this.handlers.length > 0) {
      for (const handler of this.handlers) {
        handler(entry);
      }
    } else {
      this.defaultHandler(entry);
    }
  }

  debug(category: string, message: string, data?: Record<string, unknown>): void {
    this.log('debug', category, message, data);
  }

  info(category: string, message: string, data?: Record<string, unknown>): void {
    this.log('info', category, message, data);
  }

  warn(category: string, message: string, data?: Record<string, unknown>): void {
    this.log('warn', category, message, data);
  }

  error(category: string, message: string, data?: Record<string, unknown>): void {
    this.log('error', category, message, data);
  }

  /**
   * Create a category-specific logger
   */
  category(category: string): CategoryLogger {
    return new CategoryLogger(this, category);
  }
}

class CategoryLogger {
  constructor(
    private logger: Logger,
    private categoryName: string
  ) {}

  debug(message: string, data?: Record<string, unknown>): void {
    this.logger.debug(this.categoryName, message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.logger.info(this.categoryName, message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.logger.warn(this.categoryName, message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.logger.error(this.categoryName, message, data);
  }
}

// Singleton logger instance
export const logger = new Logger();

// Convenience function to create category loggers
export const createLogger = (category: string) => logger.category(category);
