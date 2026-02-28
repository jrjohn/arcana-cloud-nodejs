import { describe, it, expect } from 'vitest';
import { IdParamSchema, PaginationQuerySchema } from '../../../src/schemas/common.schema.js';

describe('Common Schemas', () => {
  describe('IdParamSchema', () => {
    it('should validate a valid numeric user ID', () => {
      const result = IdParamSchema.safeParse({ params: { userId: '42' } });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.params.userId).toBe(42);
      }
    });

    it('should reject non-numeric user ID', () => {
      const result = IdParamSchema.safeParse({ params: { userId: 'abc' } });
      expect(result.success).toBe(false);
    });

    it('should reject empty string user ID', () => {
      const result = IdParamSchema.safeParse({ params: { userId: '' } });
      expect(result.success).toBe(false);
    });

    it('should transform string to number', () => {
      const result = IdParamSchema.safeParse({ params: { userId: '123' } });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data.params.userId).toBe('number');
      }
    });
  });

  describe('PaginationQuerySchema', () => {
    it('should validate page and perPage', () => {
      const result = PaginationQuerySchema.safeParse({
        query: { page: '1', perPage: '20' }
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.page).toBe(1);
        expect(result.data.query.perPage).toBe(20);
      }
    });

    it('should use defaults when not provided', () => {
      const result = PaginationQuerySchema.safeParse({ query: {} });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.page).toBe(1);
        expect(result.data.query.perPage).toBe(20);
      }
    });

    it('should reject non-numeric page', () => {
      const result = PaginationQuerySchema.safeParse({
        query: { page: 'abc', perPage: '10' }
      });
      expect(result.success).toBe(false);
    });

    it('should transform string numbers to actual numbers', () => {
      const result = PaginationQuerySchema.safeParse({
        query: { page: '3', perPage: '50' }
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data.query.page).toBe('number');
        expect(typeof result.data.query.perPage).toBe('number');
      }
    });
  });
});
