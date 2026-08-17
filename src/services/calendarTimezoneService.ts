export interface EnrichedAttendee {
  name: string;
  email: string;
  avatarUrl?: string;
  role?: "organizer" | "required" | "optional";
  timeZone?: string;
  timeZoneOffset?: number;
  formattedLocalTime?: string;
  source: "calendar_api" | "directory" | "manual";
}

/**
 * Formats a localized time string for an attendee based on their IANA timezone.
 */
export function getAttendeeLocalTime(timeZone: string, baseDate: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short"
    }).format(baseDate);
  } catch {
    return "UTC";
  }
}

/**
 * Fetches mailbox working hours and timezones for Microsoft Graph attendees.
 */
export async function fetchOutlookAttendeeTimezones(
  accessToken: string,
  attendeeEmails: string[],
  meetingStartTime?: string,
  meetingEndTime?: string
): Promise<Record<string, string>> {
  if (!accessToken || attendeeEmails.length === 0) return {};
  try {
    const response = await fetch("https://graph.microsoft.com/v1.0/me/calendar/getSchedule", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: 'outlook.timezone="UTC"'
      },
      body: JSON.stringify({
        schedules: attendeeEmails,
        startTime: { dateTime: meetingStartTime || new Date().toISOString(), timeZone: "UTC" },
        endTime: { dateTime: meetingEndTime || new Date(Date.now() + 3600000).toISOString(), timeZone: "UTC" },
        availabilityViewInterval: 60
      })
    });

    const data = await response.json();
    const timezoneMap: Record<string, string> = {};
    if (data.value && Array.isArray(data.value)) {
      data.value.forEach((sched: any) => {
        if (sched.workingHours?.timeZone?.name) {
          timezoneMap[sched.scheduleId.toLowerCase()] = sched.workingHours.timeZone.name;
        }
      });
    }
    return timezoneMap;
  } catch (err) {
    console.warn("Could not fetch Outlook timezones:", err);
    return {};
  }
}

/**
 * Fetches calendar timezone mappings for Google Calendar attendees.
 */
export async function fetchGoogleAttendeeTimezones(
  accessToken: string,
  attendeeEmails: string[]
): Promise<Record<string, string>> {
  if (!accessToken || attendeeEmails.length === 0) return {};
  try {
    const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        timeMin: new Date().toISOString(),
        timeMax: new Date(Date.now() + 86400000).toISOString(),
        items: attendeeEmails.map(email => ({ id: email }))
      })
    });

    const data = await response.json();
    const timezoneMap: Record<string, string> = {};
    if (data.calendars) {
      Object.keys(data.calendars).forEach((email) => {
        if (data.calendars[email]?.timeZone) {
          timezoneMap[email.toLowerCase()] = data.calendars[email].timeZone;
        }
      });
    }
    return timezoneMap;
  } catch (err) {
    console.warn("Could not fetch Google timezones:", err);
    return {};
  }
}