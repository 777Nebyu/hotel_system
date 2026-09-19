import * as Sharing from 'expo-sharing';

interface CalendarEvent {
  title: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  notes?: string;
}

function toICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function generateICS(event: CalendarEvent): string {
  const now = toICSDate(new Date());
  const dtStart = toICSDate(event.startDate);
  const dtEnd = toICSDate(event.endDate);

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LuxSty Hotel//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `DTSTAMP:${now}`,
    `UID:${now}-${Math.random().toString(36).slice(2)}@luxstyhotel`,
    `SUMMARY:${event.title}`,
    event.location ? `LOCATION:${event.location}` : '',
    event.notes ? `DESCRIPTION:${event.notes.replace(/\n/g, '\\n')}` : '',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

export async function addBookingToCalendar(event: CalendarEvent): Promise<boolean> {
  try {
    const { File, Paths } = await import('expo-file-system');
    const icsContent = generateICS(event);
    const filename = `luxsty-booking-${Date.now()}.ics`;
    const file = new File(Paths.document, filename);
    file.write(icsContent);

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) return false;

    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/calendar',
      dialogTitle: 'Add booking to calendar',
      UTI: 'public.ics',
    });

    return true;
  } catch {
    return false;
  }
}
