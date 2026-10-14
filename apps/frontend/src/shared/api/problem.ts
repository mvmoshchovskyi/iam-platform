import { isAxiosError } from 'axios';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import type { ProblemDetails } from '@/shared/types/api';

export const getProblem = (error: unknown): ProblemDetails | null => {
  if (!isAxiosError(error)) return null;
  const data = error.response?.data as Partial<ProblemDetails> | undefined;
  return data && typeof data.status === 'number' ? (data as ProblemDetails) : null;
};

export const getErrorCode = (error: unknown): string | undefined => getProblem(error)?.code;

export const getErrorMessage = (error: unknown, fallback = 'Something went wrong'): string => {
  const problem = getProblem(error);
  if (problem?.detail) return problem.detail;
  if (isAxiosError(error) && !error.response) return 'Network error — is the API running?';
  return error instanceof Error && error.message ? error.message : fallback;
};

/** Maps RFC 7807 `errors[]` onto react-hook-form fields; returns true if any were applied. */
export function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fieldMap: Partial<Record<string, Path<T>>> = {},
): boolean {
  const errors = getProblem(error)?.errors ?? [];
  for (const { field, messages } of errors) {
    setError((fieldMap[field] ?? field) as Path<T>, {
      type: 'server',
      message: messages.join(' '),
    });
  }
  return errors.length > 0;
}
