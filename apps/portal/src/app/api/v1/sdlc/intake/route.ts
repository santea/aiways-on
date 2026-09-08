import { createIntakeHandlers } from '@/features/u2-core-mgmt/request/handlers';
import { serverAuth, u2Deps } from '@/features/u2-core-mgmt/deps';

export const { POST } = createIntakeHandlers({
  requireMasterKey: (request) => serverAuth().requireMasterKey(request),
  service: () => u2Deps().intake,
});
