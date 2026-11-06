import { addDays } from '@/domain/dates';
import type { Schedule, Session } from '@/domain/types';
import { formatPaceRange } from '@/planner/paces';

function icsDate(date: string): string {
  return date.replaceAll('-', '');
}

function escape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** Fold long lines per RFC 5545 (75 octets). */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 73) {
    out.push(rest.slice(0, 73));
    rest = ' ' + rest.slice(73);
  }
  out.push(rest);
  return out.join('\r\n');
}

export function sessionSummary(s: Session): string {
  return s.distanceKm > 0 ? `${s.title}` : s.title;
}

/** Build an iCalendar document with one all-day event per planned run. */
export function scheduleToIcs(schedule: Schedule, calendarName = 'Running Planner'): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//running-planner//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escape(calendarName)}`,
  ];
  for (const week of schedule.weeks) {
    for (const s of week.sessions) {
      if (s.distanceKm <= 0 && s.type !== 'race') continue;
      const desc = [s.description, s.pace ? `Pace: ${formatPaceRange(s.pace)}` : '', `Phase: ${s.phase}`].filter(Boolean).join('\n');
      lines.push(
        'BEGIN:VEVENT',
        `UID:${s.id}@running-planner`,
        `DTSTAMP:${icsDate(s.date)}T000000Z`,
        `DTSTART;VALUE=DATE:${icsDate(s.date)}`,
        `DTEND;VALUE=DATE:${icsDate(addDays(s.date, 1))}`,
        `SUMMARY:${escape(`🏃 ${sessionSummary(s)}`)}`,
        `DESCRIPTION:${escape(desc)}`,
        'END:VEVENT',
      );
    }
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
