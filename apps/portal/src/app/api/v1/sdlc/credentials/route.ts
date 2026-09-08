import { createCredentialsHandlers } from '@/features/u2-core-mgmt/github/handlers';
import { sessionGuards, u2Deps } from '@/features/u2-core-mgmt/deps';

export const { POST } = createCredentialsHandlers({
  requireAdmin: sessionGuards.requireAdmin,
  service: () => u2Deps().githubAdmin,
});
