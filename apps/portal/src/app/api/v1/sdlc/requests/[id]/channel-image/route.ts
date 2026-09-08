import { createImageUploadHandlers } from '@/features/u2-core-mgmt/images/handlers';
import { serverAuth, u2Deps } from '@/features/u2-core-mgmt/deps';

export const { POST } = createImageUploadHandlers({
  requireMasterKey: (request) => serverAuth().requireMasterKey(request),
  service: () => u2Deps().images,
});
