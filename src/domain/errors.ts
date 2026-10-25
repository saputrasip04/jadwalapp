// src/domain/errors.ts

export interface AppError {
  kode: string;
  pesanUser: string;
  detail?: string;
  saran?: string;
  sumber?: string;
}

export function createAppError(
  kode: string,
  pesanUser: string,
  options?: { detail?: string; saran?: string; sumber?: string }
): AppError {
  return {
    kode,
    pesanUser,
    detail: options?.detail,
    saran: options?.saran,
    sumber: options?.sumber,
  };
}
