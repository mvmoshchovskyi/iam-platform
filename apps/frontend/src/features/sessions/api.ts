import { http } from '@/shared/api';
import type { Session } from '@/shared/types/api';

export const sessionsApi = {
  list: () => http.get<Session[]>('/sessions').then((r) => r.data),
  revoke: (id: string) => http.delete<void>(`/sessions/${id}`).then(() => undefined),
  revokeOthers: () => http.delete<{ revokedSessions: number }>('/sessions').then((r) => r.data),
};
