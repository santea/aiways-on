import { createAuditHandlers } from '@/features/u2-core-mgmt/audit/handlers';
import { serverAuth, u2Deps } from '@/features/u2-core-mgmt/deps';

export const { POST } = createAuditHandlers({
  requireMasterKey: (request) => serverAuth().requireMasterKey(request),
  service: () => u2Deps().audit,
});
