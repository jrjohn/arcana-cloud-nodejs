import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  delay,
  omit,
  pick,
  isValidEmail,
  generateRandomString,
  parseBoolean,
  calculateTotalPages
} from '../../../src/utils/helpers.js';

describe('Helper Utils', () => {
  describe('delay', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should delay execution', async () => {
      const callback = vi.fn();

      const promise = delay(1000).then(callback);
      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);
      await promise;

      expect(callback).toHaveBeenCalled();
    });

    it('should resolve after specified time', async () => {
      const start = Date.now();
      const promise = delay(500);

      vi.advanceTimersByTime(500);
      await promise;

      expect(Date.now() - start).toBe(500);
    });
  });

  describe('omit', () => {
    it('should omit specified keys', () => {
      const obj = { a: 1, b: 2, c: 3, d: 4 };
      const result = omit(obj, ['b', 'd']);

      expect(result).toEqual({ a: 1, c: 3 });
    });

    it('should handle empty keys array', () => {
      const obj = { a: 1, b: 2 };
      const result = omit(obj, []);

      expect(result).toEqual({ a: 1, b: 2 });
    });

    it('should not modify original object', () => {
      const obj = { a: 1, b: 2 };
      omit(obj, ['a']);

      expect(obj).toEqual({ a: 1, b: 2 });
    });

    it('should handle non-existent keys', () => {
      const obj = { a: 1 };
      const result = omit(obj, ['b' as keyof typeof obj]);

      expect(result).toEqual({ a: 1 });
    });
  });

  describe('pick', () => {
    it('should pick specified keys', () => {
      const obj = { a: 1, b: 2, c: 3, d: 4 };
      const result = pick(obj, ['a', 'c']);

      expect(result).toEqual({ a: 1, c: 3 });
    });

    it('should handle empty keys array', () => {
      const obj = { a: 1, b: 2 };
      const result = pick(obj, []);

      expect(result).toEqual({});
    });

    it('should not modify original object', () => {
      const obj = { a: 1, b: 2 };
      pick(obj, ['a']);

      expect(obj).toEqual({ a: 1, b: 2 });
    });

    it('should ignore non-existent keys', () => {
      const obj = { a: 1 };
      const result = pick(obj, ['a', 'b' as keyof typeof obj]);

      expect(result).toEqual({ a: 1 });
    });
  });

  describe('isValidEmail', () => {
    it('should return true for valid emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.org')).toBe(true);
      expect(isValidEmail('user+tag@example.co.uk')).toBe(true);
    });

    it('should return false for invalid emails', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('invalid@')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('user name@domain.com')).toBe(false);
    });
  });

  describe('generateRandomString', () => {
    it('should generate string of specified length', () => {
      expect(generateRandomString(10)).toHaveLength(10);
      expect(generateRandomString(20)).toHaveLength(20);
      expect(generateRandomString(1)).toHaveLength(1);
    });

    it('should generate different strings', () => {
      const str1 = generateRandomString(20);
      const str2 = generateRandomString(20);

      expect(str1).not.toBe(str2);
    });

    it('should only contain alphanumeric characters', () => {
      const str = generateRandomString(100);
      expect(str).toMatch(/^[A-Za-z0-9]+$/);
    });

    it('should handle length of 0', () => {
      expect(generateRandomString(0)).toBe('');
    });
  });

  describe('parseBoolean', () => {
    it('should return true for "true" string', () => {
      expect(parseBoolean('true')).toBe(true);
      expect(parseBoolean('TRUE')).toBe(true);
      expect(parseBoolean('True')).toBe(true);
    });

    it('should return true for "1" string', () => {
      expect(parseBoolean('1')).toBe(true);
    });

    it('should return false for "false" string', () => {
      expect(parseBoolean('false')).toBe(false);
      expect(parseBoolean('FALSE')).toBe(false);
    });

    it('should return false for other strings', () => {
      expect(parseBoolean('0')).toBe(false);
      expect(parseBoolean('no')).toBe(false);
      expect(parseBoolean('yes')).toBe(false);
    });

    it('should return default value for undefined', () => {
      expect(parseBoolean(undefined)).toBe(false);
      expect(parseBoolean(undefined, true)).toBe(true);
    });
  });

  describe('calculateTotalPages', () => {
    it('should calculate correct total pages', () => {
      expect(calculateTotalPages(100, 10)).toBe(10);
      expect(calculateTotalPages(101, 10)).toBe(11);
      expect(calculateTotalPages(99, 10)).toBe(10);
    });

    it('should handle zero total', () => {
      expect(calculateTotalPages(0, 10)).toBe(0);
    });

    it('should handle total less than perPage', () => {
      expect(calculateTotalPages(5, 10)).toBe(1);
    });

    it('should handle exact division', () => {
      expect(calculateTotalPages(50, 25)).toBe(2);
    });
  });
});
