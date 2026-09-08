import { createImageServeHandlers } from '@/features/u2-core-mgmt/images/handlers';
import { u2Deps } from '@/features/u2-core-mgmt/deps';

export const { GET } = createImageServeHandlers({ service: () => u2Deps().images });
