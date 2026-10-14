import { toast } from 'sonner';
import { getErrorMessage } from '@/shared/api/problem';

/** Thin wrapper so every mutation reports success/failure consistently. */
export function useToast() {
  return {
    success: (message: string, description?: string) => toast.success(message, { description }),
    error: (error: unknown, fallback?: string) => toast.error(getErrorMessage(error, fallback)),
    info: (message: string, description?: string) => toast.info(message, { description }),
  };
}
