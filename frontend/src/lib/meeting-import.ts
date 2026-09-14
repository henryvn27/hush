export type NoteImportSource = 'wispr-flow' | 'granola' | 'structured-file';

export interface ImportedTranscript {
  text: string;
  timestamp?: string;
}

export interface ImportedMeeting {
  title: string;
  createdAt?: string;
  summaryMarkdown?: string;
  transcripts: ImportedTranscript[];
  sourceKey: string;
  source: NoteImportSource;
  originalName: string;
}

export interface MeetingImportPreview {
  items: ImportedMeeting[];
  invalidFiles: string[];
  duplicateCount: number;
  truncatedCount: number;
}

const MAX_IMPORTS = 1_000;
const MAX_TEXT_LENGTH = 500_000;

function clean(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim() : '';
}

function fileBaseName(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Imported meeting';
}

function stableKey(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `hush-import-${(hash >>> 0).toString(16)}`;
}

function sourceFromName(name: string, content: string): NoteImportSource {
  const normalized = `${name}\n${content}`.toLowerCase();
  if (normalized.includes('wispr flow') || normalized.includes('copy to markdown') || /##\s+(summary|transcript)\b/.test(normalized)) {
    return 'wispr-flow';
  }
  if (name.toLowerCase().endsWith('.csv')) return 'granola';
  return 'structured-file';
}

function markdownSection(markdown: string, headingNames: string[]): string {
  const headings = headingNames.join('|');
  const match = markdown.match(new RegExp(`(?:^|\\n)#{1,3}\\s*(?:${headings})\\s*\\n([\\s\\S]*?)(?=\\n#{1,3}\\s+|$)`, 'i'));
  return clean(match?.[1]);
}

function parseDate(markdown: string): string | undefined {
  const match = markdown.match(/^(?:created|date|recorded|meeting date)\s*:\s*(.+)$/im);
  const value = clean(match?.[1]);
  if (!value || Number.isNaN(Date.parse(value))) return undefined;
  return new Date(value).toISOString();
}

function parseTranscriptLines(text: string): ImportedTranscript[] {
  const lines = text.split('\n').map(clean).filter(Boolean);
  const segments: ImportedTranscript[] = [];
  for (const line of lines) {
    const match = line.match(/^(?:[-*]\s*)?(?:\*\*)?(?:([^:*\[]+?)(?:\*\*)?\s+)?\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*[-:]?\s*(.+)$/);
    if (match) {
      const speaker = clean(match[1]);
      const textValue = clean(match[3]);
      segments.push({
        text: speaker ? `${speaker}: ${textValue}` : textValue,
        timestamp: match[2],
      });
    } else if (!/^#{1,6}\s/.test(line) && !/^[-*]\s*(?:summary|transcript|notes)\s*$/i.test(line)) {
      segments.push({ text: line });
    }
  }
  return segments;
}

function markdownMeeting(name: string, markdown: string, source: NoteImportSource): ImportedMeeting | null {
  const bounded = markdown.slice(0, MAX_TEXT_LENGTH);
  const titleMatch = bounded.match(/^#\s+(.+)$/m);
  const title = clean(titleMatch?.[1]) || fileBaseName(name);
  const summary = markdownSection(bounded, ['summary', 'brief', 'notes', 'overview']);
  const transcript = markdownSection(bounded, ['transcript', 'conversation', 'live transcript']);
  const transcriptText = transcript || (!summary ? bounded.replace(/^#\s+.+$/m, '') : '');
  const transcripts = parseTranscriptLines(transcriptText);
  const summaryMarkdown = summary || (!transcripts.length ? bounded.replace(/^#\s+.+$/m, '').trim() : '');
  const normalized = [title, parseDate(bounded) || '', summaryMarkdown, ...transcripts.map(item => `${item.timestamp || ''}:${item.text}`)].join('\n').trim();

  if (!normalized || (!summaryMarkdown && !transcripts.length)) return null;
  return {
    title,
    createdAt: parseDate(bounded),
    summaryMarkdown: summaryMarkdown || undefined,
    transcripts,
    sourceKey: stableKey(normalized.toLowerCase()),
    source,
    originalName: name,
  };
}

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(field.trim());
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function csvMeetingRows(name: string, csv: string): ImportedMeeting[] {
  const rows = parseCsvRows(csv);
  if (rows.length < 2) return [];
  const headers = rows[0].map(value => value.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
  const indexOf = (names: string[]) => headers.findIndex(header => names.includes(header));
  const titleIndex = indexOf(['title', 'name', 'meeting_title', 'note_title']);
  const summaryIndex = indexOf(['summary', 'notes', 'note', 'enhanced_notes', 'content']);
  const dateIndex = indexOf(['date', 'created_at', 'created', 'meeting_date', 'start_time']);
  if (titleIndex < 0 && summaryIndex < 0) return [];

  return rows.slice(1).flatMap((row) => {
    const title = clean(row[titleIndex]) || 'Imported Granola note';
    const summaryMarkdown = clean(row[summaryIndex]);
    const createdAtRaw = clean(row[dateIndex]);
    const createdAt = createdAtRaw && !Number.isNaN(Date.parse(createdAtRaw))
      ? new Date(createdAtRaw).toISOString()
      : undefined;
    if (!summaryMarkdown && !title) return [];
    const normalized = `${title}\n${createdAt || ''}\n${summaryMarkdown}`.toLowerCase();
    return [{
      title,
      createdAt,
      summaryMarkdown: summaryMarkdown || undefined,
      transcripts: [],
      sourceKey: stableKey(normalized),
      source: 'granola' as const,
      originalName: name,
    }];
  });
}

function valueAsMarkdown(value: unknown): string {
  if (typeof value === 'string') return clean(value);
  if (Array.isArray(value)) return value.map(item => `- ${valueAsMarkdown(item)}`).filter(value => value !== '-').join('\n');
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([key, item]) => `## ${key}\n${valueAsMarkdown(item)}`)
      .join('\n\n');
  }
  return '';
}

function jsonMeetings(name: string, json: string): ImportedMeeting[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  const records = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object'
      ? ((parsed as Record<string, unknown>).meetings || (parsed as Record<string, unknown>).notes || [parsed])
      : [];
  if (!Array.isArray(records)) return [];

  return records.flatMap((record) => {
    if (!record || typeof record !== 'object') return [];
    const value = record as Record<string, unknown>;
    const title = clean(value.title || value.name || value.meeting_title) || 'Imported meeting';
    const createdRaw = clean(value.createdAt || value.created_at || value.date || value.start_time);
    const createdAt = createdRaw && !Number.isNaN(Date.parse(createdRaw)) ? new Date(createdRaw).toISOString() : undefined;
    const summaryMarkdown = valueAsMarkdown(value.summary || value.summaryMarkdown || value.notes || value.brief);
    const transcriptValue = value.transcript || value.transcripts || value.conversation;
    const transcripts = Array.isArray(transcriptValue)
      ? transcriptValue.flatMap(item => {
        if (typeof item === 'string') return [{ text: clean(item) }];
        if (!item || typeof item !== 'object') return [];
        const segment = item as Record<string, unknown>;
        const text = clean(segment.text || segment.transcript || segment.content);
        return text ? [{ text, timestamp: clean(segment.timestamp || segment.start) || undefined }] : [];
      })
      : parseTranscriptLines(clean(transcriptValue));
    if (!summaryMarkdown && !transcripts.length) return [];
    const normalized = `${title}\n${createdAt || ''}\n${summaryMarkdown}\n${transcripts.map(item => item.text).join('\n')}`.toLowerCase();
    return [{
      title,
      createdAt,
      summaryMarkdown: summaryMarkdown || undefined,
      transcripts,
      sourceKey: stableKey(normalized),
      source: 'structured-file' as const,
      originalName: name,
    }];
  });
}

export async function parseMeetingImportFiles(files: File[]): Promise<MeetingImportPreview> {
  const items: ImportedMeeting[] = [];
  const invalidFiles: string[] = [];
  const seen = new Set<string>();
  let duplicateCount = 0;

  for (const file of files) {
    const content = await file.text();
    const extension = file.name.split('.').pop()?.toLowerCase();
    const source = sourceFromName(file.name, content);
    const parsed = extension === 'csv'
      ? csvMeetingRows(file.name, content)
      : extension === 'json'
        ? jsonMeetings(file.name, content)
        : [markdownMeeting(file.name, content, source)].filter((item): item is ImportedMeeting => item !== null);

    if (!parsed.length) {
      invalidFiles.push(file.name);
      continue;
    }
    for (const item of parsed) {
      if (seen.has(item.sourceKey)) {
        duplicateCount += 1;
      } else {
        seen.add(item.sourceKey);
        items.push(item);
      }
    }
  }

  const truncatedCount = Math.max(0, items.length - MAX_IMPORTS);
  return {
    items: items.slice(0, MAX_IMPORTS),
    invalidFiles,
    duplicateCount,
    truncatedCount,
  };
}
