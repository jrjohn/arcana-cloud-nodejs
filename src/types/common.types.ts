export interface PaginationParams {
  page: number;
  perPage: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export interface QueryParams {
  page?: number;
  perPage?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  filters?: Record<string, unknown>;
}

export interface CountParams {
  filters?: Record<string, unknown>;
}
