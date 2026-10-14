import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/query-keys';
import { useToast } from '@/shared/hooks/useToast';
import type { Session } from '@/shared/types/api';
import { sessionsApi } from './api';

export function useSessions() {
  // Security-relevant: always refetch on mount so newly signed-in devices show up immediately
  return useQuery({ queryKey: queryKeys.sessions, queryFn: sessionsApi.list, staleTime: 0 });
}

/** Optimistically removes the session from the list; rolls back if the API call fails. */
export function useRevokeSession() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: string) => sessionsApi.revoke(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.sessions });
      const previous = queryClient.getQueryData<Session[]>(queryKeys.sessions);
      queryClient.setQueryData<Session[]>(queryKeys.sessions, (old) =>
        old?.filter((s) => s.id !== id),
      );
      return { previous };
    },
    onError: (error, _id, context) => {
      queryClient.setQueryData(queryKeys.sessions, context?.previous);
      toast.error(error, 'Could not revoke the session');
    },
    onSuccess: () => toast.success('Session revoked', 'That device has been signed out.'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.sessions }),
  });
}

export function useRevokeOtherSessions() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: sessionsApi.revokeOthers,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.sessions });
      const previous = queryClient.getQueryData<Session[]>(queryKeys.sessions);
      queryClient.setQueryData<Session[]>(queryKeys.sessions, (old) =>
        old?.filter((s) => s.current),
      );
      return { previous };
    },
    onError: (error, _v, context) => {
      queryClient.setQueryData(queryKeys.sessions, context?.previous);
      toast.error(error);
    },
    onSuccess: ({ revokedSessions }) =>
      toast.success('Signed out everywhere else', `${revokedSessions} session(s) revoked.`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.sessions }),
  });
}
