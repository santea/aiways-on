import { createGithubLinksHandlers } from '@/features/u2-core-mgmt/request/handlers';
import { u2Deps } from '@/features/u2-core-mgmt/deps';

export const { GET } = createGithubLinksHandlers({ service: () => u2Deps().query });
