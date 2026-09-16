import { NextResponse } from "next/server";

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponseEnvelope<T> {
  success: boolean;
  data?: T;
  error?: ApiErrorBody;
  meta?: Record<string, unknown>;
}

export const ErrorCode = {
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  UNPROCESSABLE_ENTITY: "UNPROCESSABLE_ENTITY",
  RATE_LIMITED: "RATE_LIMITED",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Membentuk HTTP JSON Response standar untuk operasi yang sukses.
 */
export function successResponse<T>(
  data: T,
  status: number = 200,
  meta?: Record<string, unknown>,
  headers?: HeadersInit,
): NextResponse<ApiResponseEnvelope<T>> {
  const body: ApiResponseEnvelope<T> = {
    success: true,
    data,
    ...(meta ? { meta } : {}),
  };

  return NextResponse.json(body, {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

/**
 * Membentuk HTTP JSON Response standar untuk kondisi error / gagal.
 * Mencegah kebocoran stack trace atau informasi internal ke client.
 */
export function errorResponse(
  code: ErrorCodeType | string,
  message: string,
  status: number = 400,
  details?: unknown,
  headers?: HeadersInit,
): NextResponse<ApiResponseEnvelope<never>> {
  const body: ApiResponseEnvelope<never> = {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };

  return NextResponse.json(body, {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}
