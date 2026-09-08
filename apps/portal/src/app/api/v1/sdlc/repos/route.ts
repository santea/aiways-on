import { createReposHandlers } from '@/features/u2-core-mgmt/github/handlers';
import { sessionGuards, u2Deps } from '@/features/u2-core-mgmt/deps';

export const { GET, POST } = createReposHandlers({
  requireAdmin: sessionGuards.requireAdmin,
  service: () => u2Deps().githubAdmin,
});
