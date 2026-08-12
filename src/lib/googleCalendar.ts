/**
 * Google Calendar API integration helpers for Agent Chronos.
 * Handles fetching primary host timezone and querying Free/Busy data for attendees.
 */

export interface FreeBusyBlock {
  start: Date;
  end: Date;
}

export interface FreeBusyResult {
  busyBlocks: FreeBusyBlock[];
  timeZone?: string;
  error?: string;
}

/**
 * Queries Google Calendar Settings API to fetch the host's primary timezone setting.
 * @param accessToken Valid Google OAuth access token with calendar.readonly scope
 * @returns Timezone string (e.g. "America/Los_Angeles") or null if failed/unavailable
 */
export async function fetchHostCalendarTimezone(accessToken: string): Promise<string | null> {
  if (!accessToken) return null;
  try {
    const response = await fetch("https://www.googleapis.com/calendar/v3/users/me/settings/timezone", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem("gcal_access_token");
        }
        if (typeof window !== "undefined") {
          delete (window as any).__GOOGLE_ACCESS_TOKEN__;
        }
      }
      console.warn("[Google Calendar] Settings API returned status:", response.status);
      return null;
    }

    const data = await response.json();
    if (data && typeof data.value === "string" && data.value.trim().length > 0) {
      console.log("[Google Calendar] Host primary timezone detected from Calendar API:", data.value);
      return data.value.trim();
    }
  } catch (err) {
    console.warn("[Google Calendar] Failed to fetch host timezone settings:", err);
  }
  return null;
}

/**
 * Queries Google Calendar Free/Busy API for a list of attendee email addresses.
 * Resilient against private calendars, missing permissions, or network failures.
 * 
 * @param accessToken Valid Google OAuth access token
 * @param emails List of attendee email addresses
 * @param timeMin Start of range date
 * @param timeMax End of range date
 * @returns Map of email to FreeBusyResult
 */
export async function queryFreeBusyForAttendees(
  accessTokenOrAttendees: string | any[] | null,
  emailsOrDates?: any,
  timeMin?: Date,
  timeMax?: Date
): Promise<Record<string, FreeBusyResult>> {
  let accessToken: string | null = null;
  let emails: string[] = [];
  let minDate = timeMin;
  let maxDate = timeMax;

  if (Array.isArray(accessTokenOrAttendees)) {
    // Called as queryFreeBusyForAttendees(attendees, currentTargetDates)
    const attendees = accessTokenOrAttendees;
    emails = attendees.map(a => typeof a === "string" ? a : a?.email).filter(Boolean);
    accessToken = (typeof window !== "undefined" ? (window as any).__GOOGLE_ACCESS_TOKEN__ : null) || (typeof localStorage !== "undefined" ? localStorage.getItem("gcal_access_token") : null) || null;
    
    const targetDate = emailsOrDates ? new Date(emailsOrDates) : new Date();
    minDate = isNaN(targetDate.getTime()) ? new Date() : targetDate;
    minDate.setHours(0, 0, 0, 0);
    maxDate = new Date(minDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  } else {
    accessToken = accessTokenOrAttendees || (typeof window !== "undefined" ? (window as any).__GOOGLE_ACCESS_TOKEN__ : null) || (typeof localStorage !== "undefined" ? localStorage.getItem("gcal_access_token") : null) || null;
    emails = Array.isArray(emailsOrDates) ? emailsOrDates : [];
    minDate = timeMin;
    maxDate = timeMax;
  }

  const results: Record<string, FreeBusyResult> = {};
  // Clean and deduplicate list of emails, ensuring "primary" is included for the authenticated host
  const rawEmails = emails.filter(e => e && typeof e === "string" && e.includes("@"));
  const validEmails = Array.from(new Set([...rawEmails, "primary"]));

  if (!accessToken) {
    console.warn("[Google Calendar] OAuth access token (accessToken) is missing or null. Free/Busy calendar query skipped.");
    return results;
  }

  if (validEmails.length === 0) {
    console.warn("[Google Calendar] No valid attendee emails found for Free/Busy query.");
    return results;
  }

  if (!minDate || !maxDate) {
    minDate = new Date();
    minDate.setHours(0, 0, 0, 0);
    maxDate = new Date(minDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  try {
    const payload = {
      timeMin: minDate.toISOString(),
      timeMax: maxDate.toISOString(),
      items: validEmails.map(id => ({ id }))
    };

    console.log("[Google Calendar] Requesting Free/Busy payload:", JSON.stringify(payload));

    const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      if (response.status === 401) {
        console.warn("[Google Calendar] OAuth access token expired or invalid (401). Clearing stale token and using offline fallback.");
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem("gcal_access_token");
        }
        if (typeof window !== "undefined") {
          delete (window as any).__GOOGLE_ACCESS_TOKEN__;
        }
      } else {
        console.warn(`[Google Calendar] Free/Busy API returned status: ${response.status} ${response.statusText}`, errorText);
      }
      return results;
    }

    const data = await response.json();
    console.log("[Google Calendar] Raw Free/Busy API Response:", JSON.stringify(data, null, 2));

    if (data && data.calendars) {
      // Process "primary" first if available so host busy blocks are recorded
      const primaryData = data.calendars["primary"];
      const primaryBusyBlocks: FreeBusyBlock[] = primaryData && Array.isArray(primaryData.busy)
        ? primaryData.busy.map((b: { start: string; end: string }) => ({
            start: new Date(b.start),
            end: new Date(b.end)
          }))
        : [];

      for (const email of validEmails) {
        const calData = data.calendars[email];
        let busyBlocks: FreeBusyBlock[] = [];

        if (calData && Array.isArray(calData.busy)) {
          busyBlocks = calData.busy.map((b: { start: string; end: string }) => ({
            start: new Date(b.start),
            end: new Date(b.end)
          }));
        }

        // If this email is "primary" or matched 0 busy blocks but primary had busy blocks, merge primary
        if (email === "primary" || (busyBlocks.length === 0 && primaryBusyBlocks.length > 0)) {
          busyBlocks = Array.from(new Set([...busyBlocks, ...primaryBusyBlocks]));
        }

        results[email.toLowerCase()] = {
          busyBlocks,
          timeZone: calData?.timeZone || undefined,
          error: Array.isArray(calData?.errors) && calData.errors.length > 0
            ? calData.errors[0]?.reason || "Restricted calendar"
            : undefined
        };
      }

      // Also ensure "primary" key exists in results
      if (primaryBusyBlocks.length > 0 && !results["primary"]) {
        results["primary"] = { busyBlocks: primaryBusyBlocks };
      }
    }
  } catch (err) {
    console.warn("[Google Calendar] Free/Busy API query exception:", err);
  }

  return results;
}
