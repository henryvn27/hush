export interface SavedMeeting {
  id: string;
  title: string;
}

export interface SavedMeetingWithMetadata extends SavedMeeting {
  created_at: string;
  updated_at: string;
  folder_path?: string;
}

export interface SavedMeetingMetadata extends SavedMeeting {
  created_at: string;
  updated_at: string;
  folder_path?: string;
}

export interface TranscriptSearchHit extends SavedMeeting {
  matchContext: string;
  timestamp: string;
}

export interface SavedMeetingRow extends SavedMeeting {
  createdAt: string | null;
  updatedAt: string | null;
  metadataAvailable: boolean;
  matchContext: string | null;
}

export type MeetingSortOrder = 'newest' | 'oldest';
export type MeetingHistoryViewState = 'loading' | 'error' | 'empty' | 'searching' | 'no-results' | 'list';

interface MeetingHistoryStateInput {
  isLoading: boolean;
  hasLoadError: boolean;
  totalRows: number;
  visibleRows: number;
  isSearching: boolean;
}

export function deriveMeetingHistoryViewState(
  input: MeetingHistoryStateInput,
): MeetingHistoryViewState {
  if (input.isLoading) return 'loading';
  if (input.hasLoadError) return 'error';
  if (input.totalRows === 0) return 'empty';
  if (input.visibleRows === 0 && input.isSearching) return 'searching';
  if (input.visibleRows === 0) return 'no-results';
  return 'list';
}

export function createMeetingRow(
  meeting: SavedMeeting,
  metadata: SavedMeetingMetadata | null,
): SavedMeetingRow {
  return {
    id: meeting.id,
    title: metadata?.title || meeting.title,
    createdAt: metadata?.created_at || null,
    updatedAt: metadata?.updated_at || null,
    metadataAvailable: metadata !== null,
    matchContext: null,
  };
}

function meetingTime(row: SavedMeetingRow): number | null {
  const value = row.updatedAt || row.createdAt;
  if (!value) return null;

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function sortMeetingRows(
  rows: SavedMeetingRow[],
  order: MeetingSortOrder,
): SavedMeetingRow[] {
  return rows
    .map((row, index) => ({ row, index, timestamp: meetingTime(row) }))
    .sort((a, b) => {
      if (a.timestamp === null && b.timestamp === null) return a.index - b.index;
      if (a.timestamp === null) return 1;
      if (b.timestamp === null) return -1;
      if (a.timestamp === b.timestamp) return a.index - b.index;
      return order === 'newest'
        ? b.timestamp - a.timestamp
        : a.timestamp - b.timestamp;
    })
    .map(({ row }) => row);
}

export function filterMeetingRows(
  rows: SavedMeetingRow[],
  query: string,
  transcriptHits: TranscriptSearchHit[],
): SavedMeetingRow[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return rows;

  const hitsByMeeting = new Map<string, TranscriptSearchHit>();
  transcriptHits.forEach((hit) => {
    if (!hitsByMeeting.has(hit.id)) hitsByMeeting.set(hit.id, hit);
  });

  return rows
    .filter((row) => (
      row.title.toLocaleLowerCase().includes(normalizedQuery)
      || hitsByMeeting.has(row.id)
    ))
    .map((row) => ({
      ...row,
      matchContext: hitsByMeeting.get(row.id)?.matchContext || null,
    }));
}
