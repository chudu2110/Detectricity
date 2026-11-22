import { useMutation } from '@tanstack/react-query';

import { isLocalDemo } from '@/env';
import { authService, signInLocalDemo } from '@/lib/auth-client';
import { primeAccessToken } from '@/lib/session';
import { useAuthStore } from '@/stores/auth-store';

// Opens the Keycloak login in the system browser. Resolves null when the user closes it.
export function useSignIn() {
  return useMutation({
    mutationFn: async () => {
      // Temporary local demo: skip Google, using a real session for the seeded demo account.
      const result = isLocalDemo() ? await signInLocalDemo() : await authService.signIn();
      if (!result) return null;
      primeAccessToken(result.accessToken);
      useAuthStore.getState().setSignedIn(result.user);
      return result.user;
    },
  });
}
