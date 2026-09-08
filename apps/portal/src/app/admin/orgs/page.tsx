/** Org 관리 — US-U2-05 (`08-sr-registration-ui.md` §8.1). admin 전용. */
import { Section } from '@/components/ui/surface';
import { Table, TableWrap, Td, Th, EmptyRow } from '@/components/ui/table';
import { sessionGuards, u2Deps } from '@/features/u2-core-mgmt/deps';
import { CreateOrgDialog } from '@/features/u2-core-mgmt/ui/admin-dialogs';

export const dynamic = 'force-dynamic';

export default async function AdminOrgsPage() {
  // 메뉴를 숨기는 것으로 권한을 지키지 않는다 — 서버에서 다시 막는다.
  await sessionGuards.requireAdmin();
  const orgs = await u2Deps().githubAdmin.listOrgs();

  return (
    <div className="flex flex-col gap-6" data-testid="admin-orgs-page">
      <h1 className="font-headline text-2xl font-extrabold tracking-tight text-ink">
        관리 · GitHub Org
      </h1>
      <Section title={`Org ${orgs.length}건`} action={<CreateOrgDialog />}>
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Org</Th>
                <Th>URL</Th>
                <Th>자격증명</Th>
              </tr>
            </thead>
            <tbody>
              {orgs.length === 0 ? (
                <EmptyRow colSpan={3}>등록된 Org 가 없다</EmptyRow>
              ) : (
                orgs.map((org) => (
                  <tr key={org.id}>
                    <Td className="font-mono-id text-[11.5px] text-ink">{org.orgName}</Td>
                    <Td>{org.orgUrl}</Td>
                    <Td>{org.credentialId ? '연결됨' : '없음'}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </TableWrap>
      </Section>
    </div>
  );
}
