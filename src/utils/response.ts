import { v4 as uuidv4 } from 'uuid';

export interface SuccessResponse<T> {
  success: true;
  data: T;
  message: string;
  timestamp: string;
  requestId: string;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: string;
  requestId: string;
}

export interface PaginatedResponse<T> {
  success: true;
  items: T[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
  timestamp: string;
  requestId: string;
}

export function successResponse<T>(
  data: T,
  message: string = 'Success',
  requestId?: string
): SuccessResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
    requestId: requestId ?? uuidv4()
  };
}

export function errorResponse(
  message: string,
  statusCode: number = 500,
  code: string = 'INTERNAL_ERROR',
  details?: Record<string, unknown>,
  requestId?: string
): ErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details
    },
    timestamp: new Date().toISOString(),
    requestId: requestId ?? uuidv4()
  };
}

export function paginatedResponse<T>(
  items: T[],
  pagination: { page: number; perPage: number; total: number; totalPages: number },
  requestId?: string
): PaginatedResponse<T> {
  return {
    success: true,
    items,
    pagination,
    timestamp: new Date().toISOString(),
    requestId: requestId ?? uuidv4()
  };
}
