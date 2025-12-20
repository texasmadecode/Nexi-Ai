import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { logger, createLogger, LogEntry } from '../src/utils/logger.js';

describe('Logger', () => {
  beforeEach(() => {
    logger.setLevel('debug');
    logger.clearHandlers();
  });

  afterEach(() => {
    logger.setLevel('info');
    logger.clearHandlers();
  });

  describe('log levels', () => {
    it('should set and get log level', () => {
      logger.setLevel('warn');
      expect(logger.getLevel()).toBe('warn');
    });

    it('should filter messages below current level', () => {
      const entries: LogEntry[] = [];
      logger.addHandler((entry) => entries.push(entry));
      logger.setLevel('warn');

      logger.debug('test', 'Debug message');
      logger.info('test', 'Info message');
      logger.warn('test', 'Warn message');
      logger.error('test', 'Error message');

      expect(entries.length).toBe(2);
      expect(entries[0].level).toBe('warn');
      expect(entries[1].level).toBe('error');
    });

    it('should log all levels when set to debug', () => {
      const entries: LogEntry[] = [];
      logger.addHandler((entry) => entries.push(entry));
      logger.setLevel('debug');

      logger.debug('test', 'Debug');
      logger.info('test', 'Info');
      logger.warn('test', 'Warn');
      logger.error('test', 'Error');

      expect(entries.length).toBe(4);
    });
  });

  describe('handlers', () => {
    it('should call custom handlers', () => {
      let capturedMessage = '';
      let capturedCategory = '';

      logger.addHandler((entry) => {
        capturedMessage = entry.message;
        capturedCategory = entry.category;
      });

      logger.info('my-category', 'Test message');

      expect(capturedMessage).toBe('Test message');
      expect(capturedCategory).toBe('my-category');
    });

    it('should support multiple handlers', () => {
      let count = 0;
      const handler1 = () => count++;
      const handler2 = () => count++;

      logger.addHandler(handler1);
      logger.addHandler(handler2);

      logger.info('test', 'Message');

      expect(count).toBe(2);
    });

    it('should remove handlers', () => {
      let count = 0;
      const handler = () => count++;

      logger.addHandler(handler);
      logger.info('test', 'First');
      expect(count).toBe(1);

      logger.removeHandler(handler);
      logger.info('test', 'Second');
      expect(count).toBe(1);
    });

    it('should include data in log entries', () => {
      let capturedData: Record<string, unknown> | undefined;

      logger.addHandler((entry) => {
        capturedData = entry.data;
      });

      logger.info('test', 'Message', { key: 'value', count: 42 });

      expect(capturedData).toEqual({ key: 'value', count: 42 });
    });
  });

  describe('category logger', () => {
    it('should create category-specific logger', () => {
      const entries: LogEntry[] = [];
      logger.addHandler((entry) => entries.push(entry));

      const catLog = createLogger('my-module');
      catLog.info('Test message');

      expect(entries.length).toBe(1);
      expect(entries[0].category).toBe('my-module');
      expect(entries[0].message).toBe('Test message');
    });

    it('should support all log levels in category logger', () => {
      const entries: LogEntry[] = [];
      logger.addHandler((entry) => entries.push(entry));

      const catLog = createLogger('test');
      catLog.debug('Debug');
      catLog.info('Info');
      catLog.warn('Warn');
      catLog.error('Error');

      expect(entries.length).toBe(4);
      expect(entries.map((e) => e.level)).toEqual(['debug', 'info', 'warn', 'error']);
    });
  });
});
