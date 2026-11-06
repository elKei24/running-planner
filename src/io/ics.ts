import { addDays } from '@/domain/dates';
import type { Schedule, Session, Units } from '@/domain/types';
import { formatPace } from '@/planner/paces';

const KM_PER_MILE = 1.609344;

function paceText(p: NonNullable<Session['pace']>, units: Units): string {
  const f = units === 'mi' ? KM_PER_MILE : 1;
  return `${formatPace(p.minSecPerKm * f)}–${formatPace(p.maxSecPerKm * f)} /${units}`;
}

function distanceText(km: number, units: Units): string {
  return units === 'mi' ? `${(km / KM_PER_MILE).toFixed(1)} mi` : `${km} km`;
}

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
export function scheduleToIcs(schedule: Schedule, units: Units = 'km', calendarName = 'Running Planner'): string {
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
      const desc = [
        s.distanceKm > 0 ? `Distance: ${distanceText(s.distanceKm, units)}` : '',
        s.description,
        s.pace ? `Pace: ${paceText(s.pace, units)}` : '',
        `Phase: ${s.phase}`,
      ]
        .filter(Boolean)
        .join('\n');
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
