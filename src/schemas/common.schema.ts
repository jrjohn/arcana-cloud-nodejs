import { z } from 'zod';

export const IdParamSchema = z.object({
  params: z.object({
    userId: z.string().regex(/^\d+$/, 'User ID must be a number').transform(Number)
  })
});

export const PaginationQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    perPage: z.string().regex(/^\d+$/).transform(Number).optional().default('20')
  })
});

export type IdParam = z.infer<typeof IdParamSchema>['params'];
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>['query'];
