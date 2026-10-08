import type { SurfParticipation } from '../components/RenaissHub/useSurfMissions';

export type ParticipantOverview = {
  summary: { participants: number; eligibleParticipants: number; tickets: number };
  rows: SurfParticipation[]; total: number; page: number; pageSize: number;
  latestExport: { id: string; createdAt: string; participants: number; tickets: number } | null;
};

export async function readSurfParticipants(page: number, search: string): Promise<ParticipantOverview> {
  const query = new URLSearchParams({ page: String(page), search });
  const response = await fetch(`/api/admin/missions/surf/participants?${query}`, {
    headers: { Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`participants_http_${response.status}`);
  return response.json();
}

export async function exportSurfParticipants(scope: 'eligible' | 'all') {
  const response = await fetch(`/api/admin/missions/surf/participants/export?scope=${scope}`, {
    method: 'POST', headers: { Accept: 'text/csv' }, cache: 'no-store', signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`participants_http_${response.status}`);
  const filename = response.headers.get('Content-Disposition')?.match(/filename="([^";]+)"/)?.[1];
  if (!filename || !response.headers.get('X-Participant-Export-Id')) throw new Error('participant_export_invalid');
  const download = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = download; link.download = filename; link.click();
  window.setTimeout(() => URL.revokeObjectURL(download), 0);
}
