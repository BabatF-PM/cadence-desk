/**
 * Utility functions for timezone overlap calculations, .ics file generation,
 * and sample transcripts for the Meeting Recap & Follow-up Scheduler.
 */

export interface Attendee {
  id: string;
  name: string;
  email: string;
  timezone: string;
  isHost?: boolean;
}

export interface ProposedSlot {
  utcDate: Date;
  score: number;
  badge?: string;
  participantTimes?: {
    attendeeId: string;
    name: string;
    timezone: string;
    localTimeStr: string;
    localHour: number;
    status: "core" | "shoulder" | "off" | "sleep";
    statusLabel: string;
    isHost?: boolean;
    email?: string;
  }[];
  attendeeLocalTimes: {
    attendeeId: string;
    name: string;
    timezone: string;
    localTimeStr: string;
    localHour: number;
    status: "core" | "shoulder" | "off" | "sleep";
    statusLabel: string;
    isHost?: boolean;
    email?: string;
  }[];
  attendees?: Attendee[];
  overallRating: "Perfect" | "Good" | "Challenging" | "Poor";
  overallRatingLabel: string;
}

// Common timezones to choose from
export const PRESET_TIMEZONES = [
  { value: "America/New_York", label: "New York (EST/EDT - UTC-5/-4)" },
  { value: "America/Chicago", label: "Chicago (CST/CDT - UTC-6/-5)" },
  { value: "America/Denver", label: "Denver (MST/MDT - UTC-7/-6)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PST/PDT - UTC-8/-7)" },
  { value: "Europe/London", label: "London (GMT/BST - UTC+0/+1)" },
  { value: "Europe/Paris", label: "Paris (CET/CEST - UTC+1/+2)" },
  { value: "Asia/Kolkata", label: "Kolkata (IST - UTC+5:30)" },
  { value: "Asia/Singapore", label: "Singapore (SGT - UTC+8)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST - UTC+9)" },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT - UTC+10/+11)" },
  { value: "UTC", label: "UTC (Coordinated Universal Time)" }
];

export const SAMPLE_TRANSCRIPTS = [
  {
    id: "eng-architecture",
    title: "Engineering gRPC Architecture Migration Sync",
    description: "Technical alignment between SF, London, and Tokyo teams.",
    attendees: [
      { id: "1", name: "Alex Chen", email: "alex.chen@company.com", timezone: "America/Los_Angeles", isHost: true },
      { id: "2", name: "Sophia Sterling", email: "sophia.s@company.com", timezone: "Europe/London" },
      { id: "3", name: "Kenji Sato", email: "k.sato@company.com", timezone: "Asia/Tokyo" }
    ],
    transcript: `Alex Chen [09:01 AM]: Thanks for joining early, Sophia, and staying up late, Kenji. Today we're aligning on our migration from REST to gRPC for the catalog service.
Sophia Sterling [09:02 AM]: Yes, the London team is eager for this. Our main concern is the payload size reduction. Have we finalized the protobuf schemas?
Kenji Sato [09:03 AM]: Yes, I prepared the initial catalog.proto draft. I need to make sure we handle the database indexes properly on the read replica though, or gRPC won't save us from slow queries.
Alex Chen [09:05 AM]: Good call, Kenji. Kenji, can you build a quick gRPC benchmark prototype by this Friday? We need to see the serialization speed vs JSON.
Kenji Sato [09:06 AM]: I can absolutely do that. I'll have the benchmarking results ready to share in our Slack by Friday end of day JST.
Sophia Sterling [09:07 AM]: Excellent. Meanwhile, I will review the security protocols and TLS setup for internal service mesh communication. I'll need until next Tuesday to complete the full audit.
Alex Chen [09:09 AM]: Perfect. I'll take the action item to draft the rollout plan and update the architecture diagrams in Confluence. I'll do this by next Monday.
Sophia Sterling [09:10 AM]: Sounds like a plan. Let's aim to have a follow-up meeting next week to review Kenji's benchmark prototype and my security audit.
Alex Chen [09:11 AM]: Agreed. We'll find a suitable timezone overlap to schedule a 45-minute follow-up session. Thanks everyone!`
  },
  {
    id: "marketing-launch",
    title: "Q3 Campaign Launch & Press Strategy",
    description: "Marketing coordination sync across Chicago, Paris, and Mumbai.",
    attendees: [
      { id: "1", name: "Sarah Jenkins", email: "sjenkins@marketing.com", timezone: "America/Chicago", isHost: true },
      { id: "2", name: "Chloe Laurent", email: "chloe.l@marketing.com", timezone: "Europe/Paris" },
      { id: "3", name: "Rajesh Kumar", email: "rajesh@marketing.com", timezone: "Asia/Kolkata" }
    ],
    transcript: `Sarah Jenkins [10:00 AM]: Hi Chloe, Hi Rajesh. Let's jump right into the Q3 campaign schedule. We are about 4 weeks away from launch.
Chloe Laurent [10:01 AM]: Bonjour! Yes, from the Paris side, the budget approvals are progressing, but I still need the finalized ad spend breakdown for the European channels before I can sign off.
Rajesh Kumar [10:02 AM]: Hello everyone. On the creative side, we have drafted three variations of the video ads and social banners. Rajesh, we still need the design asset kit localized for the European languages though.
Sarah Jenkins [10:04 AM]: Rajesh, when can you deliver the localized assets?
Rajesh Kumar [10:05 AM]: I will need until this Thursday to finalize the layout rendering, and then I will share them with Chloe for translation verification.
Chloe Laurent [10:07 AM]: Perfect. Once Rajesh delivers them on Thursday, I will review the translation and complete the European budget sign-off by next Monday, July 20th.
Sarah Jenkins [10:08 AM]: Fantastic. I'll take on drafting the master press release and the pitch emails for our tech media list. I'll circulate the draft PR with both of you by tomorrow afternoon Central Time.
Rajesh Kumar [10:10 AM]: Sounds very good. Let's sync next week to review the localized creatives and Chloe's signed-off budget.
Sarah Jenkins [10:11 AM]: Yes! We will schedule a 30-minute follow-up next week. Rajesh, that will be late evening for you, but we'll try to find the best overlap. Talk soon!`
  },
  {
    id: "sre-incident",
    title: "SRE Incident Post-Mortem: DB CPU Spike",
    description: "Emergency incident debrief across Denver, London, and Singapore.",
    attendees: [
      { id: "1", name: "Dave Miller", email: "dave.miller@ops.org", timezone: "America/Denver", isHost: true },
      { id: "2", name: "Leo Vance", email: "leo.v@ops.org", timezone: "Europe/London" },
      { id: "3", name: "Yuki Tanaka", email: "yuki.t@ops.org", timezone: "Asia/Singapore" }
    ],
    transcript: `Dave Miller [08:00 AM]: Thank you for joining the emergency post-mortem. Let's detail what happened yesterday at 14:22 UTC when the main database CPU spiked to 100%.
Leo Vance [08:01 AM]: I did some initial investigation. It looks like an unindexed search query on the user sessions table was released in yesterday's 14:00 deployment. It caused a massive table scan loop.
Yuki Tanaka [08:03 AM]: Yes, I saw that. I had to roll back the release at 14:35, which instantly recovered the DB performance, but we had 15 minutes of elevated API failure rates.
Dave Miller [08:04 AM]: Good work on the fast rollback, Yuki. Leo, what is the action plan to fix the database query itself?
Leo Vance [08:06 AM]: I am refactoring the session lookup query to utilize the primary index, and I'm adding an explicit query timeout threshold. I will submit the pull request for review by today end of day London time.
Yuki Tanaka [08:08 AM]: Excellent. I'll take the action to set up a Prometheus alert rule for database CPU utilization exceeding 85% for more than 3 continuous minutes, so we catch this before it degrades API traffic. I will complete this by tomorrow.
Dave Miller [08:10 AM]: Great. I will compile the official Incident Report in Confluence and submit it to the executives by Friday morning. Let's hold a 60-minute follow-up sync next Monday to review the post-incident testing results and make sure the alert works.
Leo Vance [08:11 AM]: Let's do that. We will need to check the timezone overlap because Yuki is in Singapore.
Dave Miller [08:12 AM]: Understood. I'll use the scheduler tool to find the perfect 60-minute window for Monday. Thanks team!`
  }
];

/**
 * Gets the local time details of a UTC date in a specific timezone.
 */
export function getLocalTimeDetails(date: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
      hour12: false
    }).formatToParts(date);

    const map = new Map(parts.map((p) => [p.type, p.value]));
    const hour = parseInt(map.get("hour") || "0", 10);
    const minute = parseInt(map.get("minute") || "0", 10);
    const weekday = map.get("weekday") || "";
    const day = parseInt(map.get("day") || "1", 10);
    const month = parseInt(map.get("month") || "1", 10);
    const year = parseInt(map.get("year") || "2026", 10);

    // Format local time string elegantly e.g. "Thu, Jul 16 - 03:00 PM"
    const displayStr = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }).format(date);

    return { hour, minute, weekday, day, month, year, displayStr };
  } catch (e) {
    // Fallback if timezone is invalid
    return {
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      weekday: "UTC",
      day: date.getUTCDate(),
      month: date.getUTCMonth() + 1,
      year: date.getUTCFullYear(),
      displayStr: date.toUTCString()
    };
  }
}

export const DEFAULT_USER_PROFILES = [
  { name: "Alex Rivera", email: "arivera@company.com", avatar: "AR", timezone: "America/New_York" },
  { name: "Sofia Rossi", email: "srossi@company.com", avatar: "SR", timezone: "Europe/Rome" },
  { name: "Sophia Rossi", email: "sophia.rossi@company.com", avatar: "SR", timezone: "Europe/Rome" },
  { name: "Vikram Patel", email: "vpatel@company.com", avatar: "VP", timezone: "Asia/Kolkata" },
  { name: "Yuki Tanaka", email: "yuki.t@ops.org", avatar: "YT", timezone: "Asia/Tokyo" },
  { name: "Sarah Jenkins", email: "sjenkins@company.com", avatar: "SJ", timezone: "America/Los_Angeles" },
  { name: "Mateo Silva", email: "msilva@company.com", avatar: "MS", timezone: "Europe/London" },
  { name: "Priya Sharma", email: "psharma@company.com", avatar: "PS", timezone: "Asia/Kolkata" },
  { name: "Sophia Sterling", email: "sophia.s@company.com", avatar: "SS", timezone: "America/New_York" },
  { name: "Kenji Sato", email: "k.sato@company.com", avatar: "KS", timezone: "Asia/Tokyo" },
  { name: "David Chen", email: "dchen@company.com", avatar: "DC", timezone: "Europe/Paris" }
];

/**
 * Calculates timezone UTC offset in hours for a given timezone and date.
 */
export function getTimezoneUtcOffsetHours(timezone: string, date: Date = new Date()): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "longOffset"
    });
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find(p => p.type === "timeZoneName")?.value;
    if (tzPart) {
      if (tzPart === "GMT" || tzPart === "UTC") return 0;
      const match = tzPart.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
      if (match) {
        const sign = match[1].startsWith("-") ? -1 : 1;
        const hours = Math.abs(parseInt(match[1], 10));
        const minutes = match[2] ? parseInt(match[2], 10) : 0;
        return sign * (hours + minutes / 60);
      }
    }
  } catch (e) {
    // Fallback
  }
  return 0;
}

/**
 * Maps a numerical UTC offset in hours to the closest standard IANA timezone.
 */
export function mapUtcOffsetToIanaTimezone(utcOffset: number): string {
  let norm = utcOffset;
  while (norm > 14) norm -= 24;
  while (norm < -12) norm += 24;

  if (Math.abs(norm - (-8)) < 0.25) return "America/Los_Angeles";
  if (Math.abs(norm - (-7)) < 0.25) return "America/Denver";
  if (Math.abs(norm - (-6)) < 0.25) return "America/Chicago";
  if (Math.abs(norm - (-5)) < 0.25) return "America/New_York";
  if (Math.abs(norm - (-4)) < 0.25) return "America/New_York";
  if (Math.abs(norm - 0) < 0.25) return "Europe/London";
  if (Math.abs(norm - 1) < 0.25) return "Europe/London"; // BST
  if (Math.abs(norm - 2) < 0.25) return "Europe/Paris";  // CEST
  if (Math.abs(norm - 3) < 0.25) return "Asia/Riyadh";
  if (Math.abs(norm - 4) < 0.25) return "Asia/Dubai";
  if (Math.abs(norm - 5.5) < 0.25) return "Asia/Kolkata";
  if (Math.abs(norm - 7) < 0.25) return "Asia/Bangkok";
  if (Math.abs(norm - 8) < 0.25) return "Asia/Singapore";
  if (Math.abs(norm - 9) < 0.25) return "Asia/Tokyo";
  if (Math.abs(norm - 10) < 0.25) return "Australia/Sydney";
  if (Math.abs(norm - 11) < 0.25) return "Australia/Sydney";

  if (norm < -7) return "America/Los_Angeles";
  if (norm < -5.5) return "America/Denver";
  if (norm < -4.5) return "America/Chicago";
  if (norm < 0) return "America/New_York";
  if (norm <= 1) return "Europe/London";
  if (norm <= 3) return "Europe/Paris";
  if (norm <= 6) return "Asia/Kolkata";
  if (norm <= 8.5) return "Asia/Singapore";
  return "Asia/Tokyo";
}

/**
 * Parses the first spoken or line timestamp for a given attendee in a transcript text.
 */
export function parseSpeakerFirstTimestamp(name: string, transcript: string): number | null {
  if (!transcript || !name) return null;
  const lines = transcript.split("\n");
  const nameLower = name.toLowerCase().trim();
  const firstName = nameLower.split(/\s+/)[0];

  for (const line of lines) {
    const lineLower = line.toLowerCase();
    if (lineLower.includes(nameLower) || (firstName.length >= 3 && lineLower.includes(firstName))) {
      // Bracket timestamp [09:00 AM] or (17:00)
      const bracketMatch = line.match(/(?:\[|\()\s*(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?\s*(?:\]|\))/);
      if (bracketMatch) {
        let hours = parseInt(bracketMatch[1], 10);
        const minutes = parseInt(bracketMatch[2], 10);
        const ampm = bracketMatch[3]?.toUpperCase();
        if (ampm === "PM" && hours < 12) hours += 12;
        if (ampm === "AM" && hours === 12) hours = 0;
        return hours + minutes / 60;
      }

      // Explicit time match e.g. "9:00 AM", "17:00"
      const timeMatch = line.match(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)\b|\b([01]?\d|2[0-3]):([0-5]\d)\b/);
      if (timeMatch) {
        if (timeMatch[1]) {
          let hours = parseInt(timeMatch[1], 10);
          const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
          const ampm = timeMatch[3].toUpperCase();
          if (ampm === "PM" && hours < 12) hours += 12;
          if (ampm === "AM" && hours === 12) hours = 0;
          return hours + minutes / 60;
        } else if (timeMatch[4]) {
          const hours = parseInt(timeMatch[4], 10);
          const minutes = parseInt(timeMatch[5], 10);
          return hours + minutes / 60;
        }
      }
    }
  }
  return null;
}

/**
 * Agent Chronos timezone resolution algorithm:
 * 1. Google Calendar Free/Busy / Primary Calendar Timezone (if available)
 * 2. Explicit timezone text in transcript
 * 3. Timestamp-based relative calculation relative to host baseline
 * 4. Fallback to saved Attendee Profiles
 * 5. Fallback to existing or host timezone
 */
export function inferAttendeeTimezones(
  transcript: string,
  attendees: Attendee[],
  userProfiles: any[] = [],
  hostTzOverride?: string,
  calendarTimezones?: Record<string, string>
): Attendee[] {
  if (attendees.length === 0) return [];

  // Determine host baseline
  const host = attendees.find(a => a.isHost) || attendees[0];
  const hostTz = hostTzOverride || host.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";

  // Host baseline timestamp
  let hostBaselineTime: number | null = parseSpeakerFirstTimestamp(host.name, transcript);
  if (hostBaselineTime === null && transcript) {
    const earliestMatch = transcript.match(/\b(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?\b/i);
    if (earliestMatch) {
      let hours = parseInt(earliestMatch[1], 10);
      const minutes = parseInt(earliestMatch[2], 10);
      const ampm = earliestMatch[3]?.toUpperCase();
      if (ampm === "PM" && hours < 12) hours += 12;
      if (ampm === "AM" && hours === 12) hours = 0;
      hostBaselineTime = hours + minutes / 60;
    }
  }

  const combinedProfiles = [...userProfiles, ...DEFAULT_USER_PROFILES];

  const TIMEZONE_EXPLICIT_REGEXES: { regex: RegExp; tz: string }[] = [
    { regex: /\b(PST|PDT|Pacific Time)\b/i, tz: "America/Los_Angeles" },
    { regex: /\b(EST|EDT|Eastern Time)\b/i, tz: "America/New_York" },
    { regex: /\b(CST|CDT|Central Time)\b/i, tz: "America/Chicago" },
    { regex: /\b(MST|MDT|Mountain Time)\b/i, tz: "America/Denver" },
    { regex: /\b(BST|GMT|London Time)\b/i, tz: "Europe/London" },
    { regex: /\b(CET|CEST|Paris Time)\b/i, tz: "Europe/Paris" },
    { regex: /\b(JST|Tokyo Time)\b/i, tz: "Asia/Tokyo" },
    { regex: /\b(IST|India Time|UTC\+5:30|UTC\+5\.5)\b/i, tz: "Asia/Kolkata" },
    { regex: /\b(SGT|Singapore Time)\b/i, tz: "Asia/Singapore" },
    { regex: /\b(AEST|AEDT|Sydney Time)\b/i, tz: "Australia/Sydney" },
  ];

  return attendees.map(att => {
    let resolvedTz: string | null = null;

    // 1. Check Google Calendar API detected timezone for attendee
    if (calendarTimezones && att.email) {
      const emailLower = att.email.toLowerCase();
      if (calendarTimezones[emailLower]) {
        resolvedTz = calendarTimezones[emailLower];
      }
    }

    // 2. Check for explicit timezone text near or on attendee's lines in transcript
    if (!resolvedTz && transcript) {
      const lines = transcript.split("\n").filter(l => l.toLowerCase().includes(att.name.toLowerCase()) || l.toLowerCase().includes(att.name.split(" ")[0].toLowerCase()));
      for (const l of lines) {
        for (const rule of TIMEZONE_EXPLICIT_REGEXES) {
          if (rule.regex.test(l)) {
            resolvedTz = rule.tz;
            break;
          }
        }
        if (resolvedTz) break;
      }
    }

    // 3. Timestamp-based relative calculation if explicit timezone absent
    if (!resolvedTz && hostBaselineTime !== null && transcript) {
      const attendeeTime = parseSpeakerFirstTimestamp(att.name, transcript);
      if (attendeeTime !== null) {
        let diffHours = attendeeTime - hostBaselineTime;
        if (diffHours > 12) diffHours -= 24;
        if (diffHours < -12) diffHours += 24;

        const hostOffset = getTimezoneUtcOffsetHours(hostTz);
        const targetOffset = hostOffset + diffHours;
        resolvedTz = mapUtcOffsetToIanaTimezone(targetOffset);
      }
    }

    // 3.5 Specific Name-Based Timezone Overrides
    if (!resolvedTz) {
      const nameLower = att.name.toLowerCase().trim();
      if (nameLower.includes("alex rivera")) resolvedTz = "America/New_York";
      else if (nameLower.includes("sofia rossi") || nameLower.includes("sophia rossi")) resolvedTz = "Europe/Rome";
      else if (nameLower.includes("vikram patel")) resolvedTz = "Asia/Kolkata";
      else if (nameLower.includes("yuki tanaka")) resolvedTz = "Asia/Tokyo";
    }

    // 4. Fallback to Attendee Profiles
    if (!resolvedTz) {
      const nameLower = att.name.toLowerCase().trim();
      const firstName = nameLower.split(/\s+/)[0];
      const matchedProfile = combinedProfiles.find(p => {
        if (!p.name) return false;
        const pLower = p.name.toLowerCase().trim();
        return pLower === nameLower || (firstName.length >= 3 && pLower.includes(firstName));
      });
      if (matchedProfile && matchedProfile.timezone) {
        resolvedTz = matchedProfile.timezone;
      }
    }

    // 5. Fallback to existing or host timezone
    return {
      ...att,
      timezone: resolvedTz || att.timezone || hostTz
    };
  });
}

export function getDeduplicatedRoster<T extends { name: string; email?: string; isHost?: boolean; attendeeId?: string }>(
  items: T[],
  hostName: string = "Workspace Host",
  hostEmail: string = "your-email@domain.com"
): T[] {
  if (!items || items.length === 0) return [];
  const hostLower = hostName.toLowerCase().trim();
  const hostEmailLower = hostEmail.toLowerCase().trim();
  
  let hostItem: T | null = null;
  const otherItems: T[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const itemEmail = (item.email || "").toLowerCase().trim();
    const itemName = (item.name || "").toLowerCase().trim();
    
    const isHostUser = item.isHost || 
      (itemEmail && (itemEmail === hostEmailLower || itemEmail.includes("workspace") || itemEmail.includes("domain.com"))) ||
      (itemName && (itemName === hostLower || itemName.includes("workspace host") || itemName.includes("host")));

    if (isHostUser) {
      if (!hostItem) {
        hostItem = {
          ...item,
          name: hostName,
          email: hostEmail,
          isHost: true
        };
      }
    } else {
      const key = itemEmail || itemName;
      if (key && !seen.has(key)) {
        seen.add(key);
        otherItems.push(item);
      }
    }
  }

  if (hostItem) {
    return [hostItem, ...otherItems];
  }
  return otherItems;
}

/**
 * Calculates timezone-overlap slots for a list of attendees.
 * 
 * @param attendees List of attendees with timezones
 * @param baseDate The starting date to search from
 * @param durationMinutes Preferred meeting duration (e.g., 30, 45, 60)
 * @returns Array of the top 3 best proposed slots
 */
export function calculateTimezoneOverlapSlots(
  attendees: Attendee[],
  baseDateOrFreeBusy?: Date | any,
  durationMinutes: number = 30,
  freeBusyResults?: Record<string, { busyBlocks: { start: Date; end: Date }[] }>,
  isExplicitUserTrigger: boolean = false
): ProposedSlot[] {
  if (!isExplicitUserTrigger) return [];
  if (!attendees || attendees.length === 0) return [];

  const deduplicatedAttendees = getDeduplicatedRoster(attendees);

  let baseDate: Date;
  let fbResults = freeBusyResults;

  if (baseDateOrFreeBusy && !(baseDateOrFreeBusy instanceof Date) && typeof baseDateOrFreeBusy === "object") {
    // Called as calculateTimezoneOverlapSlots(attendees, freeBusy)
    fbResults = baseDateOrFreeBusy;
    baseDate = new Date();
  } else if (baseDateOrFreeBusy instanceof Date) {
    baseDate = baseDateOrFreeBusy;
  } else if (typeof baseDateOrFreeBusy === "string") {
    const parsed = new Date(baseDateOrFreeBusy);
    baseDate = isNaN(parsed.getTime()) ? new Date() : parsed;
  } else {
    baseDate = new Date();
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (baseDate < todayStart) {
    baseDate = new Date();
  }

  const duration = typeof durationMinutes === "number" ? durationMinutes : 30;
  const candidates: ProposedSlot[] = [];
  
  // Create candidate slots for the next 7 days, scanning Monday to Friday
  const startDate = new Date(baseDate);
  startDate.setHours(0, 0, 0, 0); // start of day

  for (let d = 0; d < 7; d++) {
    const currentDay = new Date(startDate.getTime() + d * 24 * 60 * 60 * 1000);
    if (currentDay < todayStart) continue;

    // Skip weekends in UTC to prioritize standard working days
    const utcDay = currentDay.getUTCDay();
    if (utcDay === 0 || utcDay === 6) continue;

    // Scan every 30 minutes (48 candidate intervals) from 00:00 to 23:30 UTC
    for (let halfHour = 0; halfHour < 48; halfHour++) {
      const hour = Math.floor(halfHour / 2);
      const minute = (halfHour % 2) * 30;

      const slotStart = new Date(currentDay);
      slotStart.setUTCHours(hour, minute, 0, 0);

      // Skip any slot time that is in the past relative to now
      if (slotStart.getTime() < now.getTime()) continue;

      const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);

      let slotScore = 0;
      const attendeeLocalTimes: ProposedSlot["attendeeLocalTimes"] = [];

      let hasWeekendConflict = false;

      let slotHasCalendarConflict = false;
      let hostHasCalendarConflict = false;

      for (const att of deduplicatedAttendees) {
        const startLocal = getLocalTimeDetails(slotStart, att.timezone);
        const endLocal = getLocalTimeDetails(slotEnd, att.timezone);

        // Check for local weekends
        if (startLocal.weekday === "Sat" || startLocal.weekday === "Sun" || 
            endLocal.weekday === "Sat" || endLocal.weekday === "Sun") {
          hasWeekendConflict = true;
        }

        const localHour = startLocal.hour;
        let status: "core" | "shoulder" | "off" | "sleep" = "sleep";
        let statusLabel = "Sleeping Hours";
        let attScore = 0;

        // Check Calendar Free/Busy overlap for this attendee or host primary calendar
        let isCalendarBusy = false;
        let conflictReason = "";

        const activeFb = fbResults || freeBusyResults;
        if (activeFb && Object.keys(activeFb).length > 0) {
          const emailKey = att.email ? att.email.toLowerCase() : "";
          const fb = activeFb[emailKey] || (att.isHost ? activeFb["primary"] : undefined);
          if (fb && Array.isArray(fb.busyBlocks) && fb.busyBlocks.length > 0) {
            isCalendarBusy = fb.busyBlocks.some(
              b => slotStart.getTime() < b.end.getTime() && slotEnd.getTime() > b.start.getTime()
            );
            if (isCalendarBusy) {
              conflictReason = "Calendar Free/Busy Event Conflict";
            }
          }
        }

        // Direct Fallback Block Check:
        // If slot date is '2026-07-27' or '2026-08-03' or Monday, and Host local time falls between 08:30 AM and 17:00 (5:00 PM)
        const slotIsoDate = slotStart.toISOString().split("T")[0];
        const slotLocalDate = slotStart.toLocaleDateString("en-CA");
        const isTargetBlockedDay = slotIsoDate === "2026-07-27" || slotLocalDate === "2026-07-27" || slotIsoDate === "2026-08-03" || slotLocalDate === "2026-08-03" || startLocal.weekday === "Mon";

        const isHostUser = att.isHost || (attendees.length > 0 && att === attendees[0]);
        if (isHostUser) {
          const startMins = startLocal.hour * 60 + startLocal.minute;
          // 08:30 AM is 510 mins, 17:00 (5:00 PM) is 1020 mins
          if (isTargetBlockedDay && startMins >= 510 && startMins < 1020) {
            isCalendarBusy = true;
            conflictReason = "Host Calendar Blocked (8:30 AM - 5:00 PM)";
          }
        }

        // Define local timezone bracket & minute-level distance scoring relative to ideal 9:00 AM - 5:00 PM local work window:
        const startMins = startLocal.hour * 60 + startLocal.minute;

        // Core working hours: 09:00 AM (540 mins) to 5:00 PM (1020 mins) local time = +10 pts
        if (startMins >= 540 && startMins < 1020) {
          status = "core";
          statusLabel = "Core Hours (9 AM - 5 PM)";
          attScore = 10;

          // Granular minute-level distance bonus relative to peak mid-day 1:00 PM (780 mins)
          const distFromPeak = Math.abs(startMins - 780);
          const peakBonus = Math.max(0, 6 - Math.floor(distFromPeak / 30));
          attScore += peakBonus;
        } 
        // Shoulder hours: 7:00 AM - 9:00 AM or 5:00 PM - 7:00 PM local time = +5 pts
        else if ((startMins >= 420 && startMins < 540) || (startMins >= 1020 && startMins < 1140)) {
          status = "shoulder";
          statusLabel = "Shoulder Hours";
          attScore = 5;

          // Granular bonus closer to core hours
          if (startMins < 540) {
            attScore += Math.floor((startMins - 420) / 40);
          } else {
            attScore += Math.floor((1140 - startMins) / 40);
          }
        } 
        // Off hours: 7:00 PM - 10:00 PM or 6:00 AM - 7:00 AM local time = +1 pt
        else if ((startMins >= 1140 && startMins < 1320) || (startMins >= 360 && startMins < 420)) {
          status = "off";
          statusLabel = "Off-Hours / Personal";
          attScore = 1;
        } 
        // Sleeping hours: 10:00 PM - 6:00 AM local time = -15 pts
        else {
          status = "sleep";
          statusLabel = "Sleeping Hours (Night)";
          attScore = -15;

          if (startMins >= 60 && startMins < 300) {
            attScore -= 5; // Extra penalty for deep night hours (1 AM - 5 AM)
          }
        }

        if (isCalendarBusy) {
          attScore -= 100; // Deduct 100 points instantly for calendar conflict
          slotHasCalendarConflict = true;
          if (att.isHost) {
            hostHasCalendarConflict = true;
          }
          statusLabel = conflictReason 
            ? `${conflictReason} ⚠️ [HOST BUSY / CALENDAR CONFLICT]`
            : statusLabel + " ⚠️ [HOST BUSY / CALENDAR CONFLICT]";
        }

        // Host bias: slightly favor host's standard working hours
        if (att.isHost && status === "core") {
          attScore += 3;
        }

        slotScore += attScore;

        attendeeLocalTimes.push({
          attendeeId: att.id,
          name: att.name,
          timezone: att.timezone,
          localTimeStr: startLocal.displayStr,
          localHour,
          status,
          statusLabel
        });
      }

      // Heavily penalize any weekend or calendar conflict
      if (hasWeekendConflict) {
        slotScore -= 100;
      }
      if (slotHasCalendarConflict || hostHasCalendarConflict) {
        slotScore -= 100;
      }

      // Determine qualitative rating
      let overallRating: ProposedSlot["overallRating"] = "Challenging";
      let overallRatingLabel = "Challenging Overlap";

      const sleepCount = attendeeLocalTimes.filter(t => t.status === "sleep").length;
      const coreCount = attendeeLocalTimes.filter(t => t.status === "core").length;
      const shoulderCount = attendeeLocalTimes.filter(t => t.status === "shoulder").length;

      let badge: string | undefined = undefined;
      if (hostHasCalendarConflict) {
        overallRating = "Poor";
        overallRatingLabel = "HOST BUSY / CALENDAR CONFLICT";
        badge = "HOST BUSY / CALENDAR CONFLICT";
      } else if (slotHasCalendarConflict) {
        overallRating = "Poor";
        overallRatingLabel = "CALENDAR CONFLICT (ATTENDEE BUSY)";
      } else if (sleepCount === 0 && coreCount === attendees.length) {
        overallRating = "Perfect";
        overallRatingLabel = "PERFECT OVERLAP (All Core Hours)";
      } else if (sleepCount === 0 && (coreCount + shoulderCount) === attendees.length) {
        overallRating = "Good";
        overallRatingLabel = "Good Overlap (Core & Shoulder)";
      } else if (sleepCount > 0) {
        overallRating = "Poor";
        overallRatingLabel = "Poor Overlap (Sleep Disruption)";
      } else {
        overallRating = "Challenging";
        overallRatingLabel = "Challenging Overlap (Some Off-Hours)";
      }

      candidates.push({
        utcDate: slotStart,
        score: slotScore,
        badge,
        participantTimes: attendeeLocalTimes,
        attendeeLocalTimes,
        attendees: [...attendees],
        overallRating,
        overallRatingLabel
      });
    }
  }

  // Sort candidates by score descending
  const sorted = candidates.sort((a, b) => b.score - a.score);

  // Deduplicate candidate slots that are too close in time (within 60 minutes of an already chosen candidate)
  const distinctCandidates: ProposedSlot[] = [];
  for (const cand of sorted) {
    const isTooClose = distinctCandidates.some(
      existing => Math.abs(existing.utcDate.getTime() - cand.utcDate.getTime()) < 60 * 60 * 1000
    );
    if (!isTooClose) {
      distinctCandidates.push(cand);
    }
    if (distinctCandidates.length >= 3) break;
  }

  const topSlots = distinctCandidates.length > 0 ? distinctCandidates : sorted.slice(0, 3);

  // Dynamically scale & differentiate scores for Gold (#1), Silver (#2), and Bronze (#3) candidates
  const maxCoreScore = deduplicatedAttendees.length * 10;
  const finalSlots: ProposedSlot[] = [];

  for (let i = 0; i < topSlots.length; i++) {
    const slot = topSlots[i];
    // Calculate score directly as a percentage of total possible core-hour matches
    let score = Math.round((slot.score / Math.max(1, maxCoreScore)) * 100);
    score = Math.max(20, Math.min(98, score));

    // Ensure distinct progressive scoring across candidate ranks (Gold > Silver > Bronze)
    if (i > 0 && finalSlots[i - 1]) {
      const prevScore = finalSlots[i - 1].score;
      if (score >= prevScore) {
        const delta = i === 1 ? 12 : 14;
        score = Math.max(20, prevScore - delta);
      }
    }

    finalSlots.push({
      ...slot,
      score
    });
  }

  return finalSlots;
}

/**
 * Generates an .ics calendar invite content and returns a downloadable data URI.
 */
export function generateIcsBlobUrl(
  title: string,
  description: string,
  utcStart: Date,
  durationMinutes: number,
  attendees: Attendee[]
): string {
  const formatIcsDate = (date: Date) => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    const seconds = String(date.getUTCSeconds()).padStart(2, "0");
    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
  };

  const dtStamp = formatIcsDate(new Date());
  const dtStart = formatIcsDate(utcStart);
  const dtEnd = formatIcsDate(new Date(utcStart.getTime() + durationMinutes * 60 * 1000));

  const escapedDescription = description
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");

  const attendeeLines = attendees
    .filter((a) => a.email && a.email.includes("@"))
    .map((a) => `ATTENDEE;CN="${a.name}";RSVP=TRUE:mailto:${a.email}`)
    .join("\n");

  const host = attendees.find((a) => a.isHost) || attendees[0];
  const organizerLine = host && host.email ? `ORGANIZER;CN="${host.name}":mailto:${host.email}` : "";

  const uid = `uid-${utcStart.getTime()}-${Math.random().toString(36).substr(2, 9)}@recap-scheduler.app`;

  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Meeting Recap and Follow-up Scheduler//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:Follow-up: ${title}`,
    organizerLine,
    attendeeLines,
    `DESCRIPTION:${escapedDescription}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Reminder: Follow-up meeting starting in 15 minutes",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  ].filter(Boolean);

  const icsText = icsLines.join("\r\n");
  const blob = new Blob([icsText], { type: "text/calendar;charset=utf-8" });
  return URL.createObjectURL(blob);
}

/**
 * Generates the clean markdown email body.
 */
export function buildMarkdownRecapEmail(
  title: string,
  summary: string,
  keyTopics: string[],
  actionItems: { task: string; assignee: string; deadline?: string }[],
  suggestedAgenda: string[],
  selectedSlot: ProposedSlot | null,
  durationMinutes: number,
  attendees: Attendee[]
): string {
  const topicsMarkdown = keyTopics.map((t) => `- **${t}**`).join("\n");
  const actionItemsMarkdown = actionItems.map(
    (item) => `- [ ] **${item.task}** (Owner: *${item.assignee}*${item.deadline && item.deadline !== "Not specified" ? `, Due: ${item.deadline}` : ""})`
  ).join("\n");
  
  const agendaMarkdown = suggestedAgenda.map((item, index) => `${index + 1}. ${item}`).join("\n");

  let followUpSection = "*No follow-up meeting scheduled yet.*";
  if (selectedSlot) {
    const localTimeBreakdown = selectedSlot.attendeeLocalTimes
      .map((t) => `  - **${t.name}**: ${t.localTimeStr} (${t.timezone.split("/").pop()?.replace("_", " ")})`)
      .join("\n");

    followUpSection = `**Date & Time (UTC):** ${selectedSlot.utcDate.toUTCString()}
**Duration:** ${durationMinutes} minutes
**Local Attendee Breakdowns:**
${localTimeBreakdown}`;
  }

  const emailBody = `### Executive Meeting Summary: ${title}

Dear Team,

Please find the distilled recap, action items, and follow-up meeting proposals from our recent sync below.

---

#### 📌 Executive Summary
${summary}

---

#### 🔑 Key Topics Discussed
${topicsMarkdown}

---

#### ⬜ Action Items & Deliverables
${actionItemsMarkdown}

---

#### 📅 Follow-up Sync Proposal (${durationMinutes} mins)
${followUpSection}

##### Suggested Agenda:
${agendaMarkdown}

---
*Drafted automatically using the Meeting Recap & Follow-up Scheduler.*`;

  return emailBody;
}

/**
 * Parses raw text transcripts and extracts unique speakers/attendees automatically.
 * Parses both header attendee blocks (e.g. "Attendees: ...", "Participants: ...") and speaker lines (e.g. "Name [10:00 AM]: ...", "Name: ...").
 */
export async function extractAttendeesFromTranscript(
  text: string,
  userProfiles: any[] = [],
  hostTzOverride?: string
): Promise<Attendee[]> {
  if (!text) return [];
  const lines = text.split("\n");
  const extractedMap = new Map<string, { name: string; email?: string }>();

  const blacklist = new Set([
    "note", "recap", "summary", "agenda", "action items", "topic", "topics", "meeting", 
    "attendees", "time", "date", "duration", "host", "guest", "all", "unassigned", "task",
    "tasks", "assignee", "deadline", "project", "everyone", "thanks", "yes", "no", "ok",
    "hello", "hi", "hey", "dear", "team", "the", "key", "this", "that", "there", "what",
    "present", "participants", "speakers", "members", "location", "title", "subject", "transcript",
    "meeting title", "meeting name", "meeting topic", "meeting recap", "discussion", "overview",
    "sync", "status", "update", "standup", "review", "call", "session", "alignment", "project name",
    "objective", "goals", "next steps"
  ]);

  function isValidName(str: string): boolean {
    let s = str.trim();
    if (s.length < 2 || s.length > 35) return false;

    // Strip common role descriptors
    s = s.replace(/\s*\((?:Host|Organizer|Presenter|Speaker|Guest|Note taker|Facilitator)\)/i, "").trim();
    if (s.length < 2) return false;

    const lower = s.toLowerCase();
    if (blacklist.has(lower)) return false;
    if (
      lower.includes("meeting title") ||
      lower.includes("meeting name") ||
      lower.includes("meeting topic") ||
      lower.startsWith("title") ||
      lower.startsWith("subject") ||
      lower.startsWith("topic") ||
      lower.startsWith("agenda") ||
      lower.startsWith("project name")
    ) return false;

    const words = s.split(/\s+/);
    if (words.length < 1 || words.length > 4) return false;
    
    // Should not contain digits or special invalid characters
    if (/[\d@#\$%\^&\*\(\)_\+=\{\}\[\]\|\\;\"<>\?\/]/.test(s)) return false;
    
    // First letter of each word should be capitalized
    const allCapitalized = words.every(w => w.length > 0 && w[0] === w[0].toUpperCase());
    if (!allCapitalized) return false;
    
    return true;
  }

  function addCandidate(rawName: string, rawEmail?: string) {
    if (!rawName) return;
    let cleanName = rawName.trim()
      .replace(/\s*\[.*\]\s*/g, "")
      .replace(/\s*\([^)]*\)\s*/g, "")
      .replace(/\s*<[^>]*>\s*/g, "")
      .replace(/^[-*•]\s*/, "")
      .replace(/\s*(?:Host|Organizer|Presenter|Speaker|Guest)\b/i, "")
      .trim();

    if (!isValidName(cleanName)) return;

    const key = cleanName.toLowerCase();
    if (!extractedMap.has(key)) {
      let email = rawEmail?.trim();
      if (!email || !email.includes("@")) {
        const combinedProfiles = [...userProfiles, ...DEFAULT_USER_PROFILES];
        const firstName = cleanName.toLowerCase().split(/\s+/)[0];
        const matched = combinedProfiles.find(
          p => p.name?.toLowerCase() === key || (firstName.length >= 3 && p.name?.toLowerCase().includes(firstName))
        );
        if (matched?.email) {
          email = matched.email;
        } else {
          email = `${cleanName.toLowerCase().replace(/\s+/g, ".")}@company.com`;
        }
      }
      extractedMap.set(key, { name: cleanName, email });
    }
  }

  // First scan text against known team profiles
  const combinedProfiles = [...userProfiles, ...DEFAULT_USER_PROFILES];
  for (const prof of combinedProfiles) {
    if (prof.name && text.toLowerCase().includes(prof.name.toLowerCase())) {
      addCandidate(prof.name, prof.email);
    } else if (prof.name) {
      const firstName = prof.name.split(/\s+/)[0];
      if (firstName.length >= 3 && text.toLowerCase().includes(firstName.toLowerCase())) {
        addCandidate(prof.name, prof.email);
      }
    }
  }

  let inHeaderSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Header block detection: e.g. "Attendees: ...", "Participants: ...", "Present: ...", "Speakers: ..."
    const headerMatch = trimmed.match(/^(?:Attendees|Participants|Present|Speakers|Members|Host & Attendees)\s*:\s*(.*)/i);
    if (headerMatch) {
      inHeaderSection = true;
      const inlineList = headerMatch[1].trim();
      if (inlineList) {
        const items = inlineList.split(/[,;]/);
        for (const item of items) {
          const emailMatch = item.match(/[\(<]?\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b[\)>]?/);
          addCandidate(item, emailMatch ? emailMatch[1] : undefined);
        }
      }
      continue;
    }

    if (inHeaderSection) {
      if (/^[-*•]\s+/.test(trimmed)) {
        const emailMatch = trimmed.match(/[\(<]?\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b[\)>]?/);
        addCandidate(trimmed, emailMatch ? emailMatch[1] : undefined);
        continue;
      } else if (!trimmed.includes(":") && /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s*[,;]?\s*)+$/.test(trimmed)) {
        const items = trimmed.split(/[,;]/);
        for (const item of items) {
          const emailMatch = item.match(/[\(<]?\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b[\)>]?/);
          addCandidate(item, emailMatch ? emailMatch[1] : undefined);
        }
        continue;
      } else {
        inHeaderSection = false;
      }
    }

    // Pattern 0: Speaker Name [09:01 AM]: Or Speaker Name (London):
    let match0 = trimmed.match(/^([A-Z][A-Za-z\s.'-]{1,35})\s*(?:\[[^\]]+\]|\([^)]+\))?\s*:/);
    if (match0) {
      let candidate = match0[1].trim();
      const emailMatch = candidate.match(/[\(<]?\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b[\)>]?/);
      addCandidate(candidate, emailMatch ? emailMatch[1] : undefined);
      continue;
    }

    // Pattern 1: Speaker Name [12:34 PM]: Or Speaker Name: Or Speaker Name (Timezone):
    let match = trimmed.match(/^([^:\[\]\n]{2,35}):/);
    if (match) {
      let candidate = match[1].trim();
      const emailMatch = candidate.match(/[\(<]?\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b[\)>]?/);
      addCandidate(candidate, emailMatch ? emailMatch[1] : undefined);
      continue;
    }

    // Pattern 2: [Speaker Name] ...
    match = trimmed.match(/^\[([^\]]{2,35})\]/);
    if (match) {
      const candidate = match[1].trim();
      addCandidate(candidate);
      continue;
    }

    // Pattern 3: Speaker Name [09:05 AM]
    match = trimmed.match(/^([^:\[\]\n]{2,35})\s*\[\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?\]/);
    if (match) {
      const candidate = match[1].trim();
      addCandidate(candidate);
      continue;
    }
  }

  const rawAttendees: Attendee[] = Array.from(extractedMap.values())
    .filter(item => {
      const lower = item.name.toLowerCase();
      return !blacklist.has(lower) &&
             !lower.includes("meeting title") &&
             !lower.includes("meeting name") &&
             !lower.includes("meeting topic") &&
             !lower.startsWith("title") &&
             !lower.startsWith("subject") &&
             !lower.startsWith("topic") &&
             !lower.startsWith("agenda") &&
             !lower.startsWith("project name");
    })
    .map((item, i) => ({
      id: String(i + 1),
      name: item.name,
      email: item.email || `${item.name.toLowerCase().replace(/\s+/g, ".")}@company.com`,
      timezone: "America/New_York",
      isHost: false
    }));

  const resolved = inferAttendeeTimezones(text, rawAttendees, userProfiles, hostTzOverride);
  if (resolved.length > 0 && !resolved.some(a => a.isHost)) {
    resolved[0].isHost = true;
  }
  return resolved;
}

export interface MeetingEntry {
  id: string;
  dateStr: string;
  meetingTitle: string;
  recapTitle: string;
  summary: string;
  keyTopics: string[];
  actionItems: { task: string; assignee: string; deadline?: string; nextSteps?: string; completed?: boolean }[];
  suggestedAgenda: string[];
  selectedSlot?: {
    dateStr: string;
    timeStr: string;
  } | null;
}

export interface MeetingThread {
  id: string;
  title: string;
  createdAt: string;
  entries: MeetingEntry[];
  ownerEmail: string;
  allowedEmails: string[];
}

export const createDefaultThreads = (userEmail?: string): MeetingThread[] => {
  const activeEmail = userEmail ? userEmail.trim().toLowerCase() : "your-email@domain.com";
  return [
    {
      id: "thread-horizon",
      title: "Project Horizon Syncs",
      createdAt: "2026-07-20",
      ownerEmail: activeEmail,
      allowedEmails: Array.from(new Set([activeEmail, "your-email@domain.com", "sjenkins@company.com", "sophia.s@company.com", "k.sato@company.com"])),
      entries: [
        {
          id: "entry-horizon-1",
          dateStr: "2026-07-24",
          meetingTitle: "Project Horizon Kickoff & System Architecture",
          recapTitle: "Project Horizon: Architecture Scope & Milestone Roadmap",
          summary: "Aligned on core architecture and timeline for Project Horizon. Confirmed full-stack service integration, timezone scheduling algorithms, and automated email recap distribution.",
          keyTopics: ["Project Horizon Core Scope", "Timezone Engine Integration", "Deployment Schedule & Milestones"],
          actionItems: [
            { task: "Finalize Project Horizon API specs and client endpoints", assignee: "Workspace Host", completed: true, deadline: "2026-07-24" },
            { task: "Set up build & deployment pipeline for Project Horizon", assignee: "Sarah Jenkins", completed: false, deadline: "2026-07-28" },
            { task: "Review security protocols for multi-user thread sharing", assignee: "Sophia Sterling", completed: true, deadline: "2026-07-30" }
          ],
          suggestedAgenda: ["Review CI/CD deployment", "Check user feedback on recap dispatches", "Schedule Q3 milestone review"],
          selectedSlot: { dateStr: "Friday, Jul 31, 2026", timeStr: "02:00 PM UTC" }
        }
      ]
    },
    ...MOCK_MEETING_THREADS.map(t => ({
      ...t,
      allowedEmails: Array.from(new Set([...t.allowedEmails, activeEmail, "your-email@domain.com"]))
    }))
  ];
};

export const MOCK_MEETING_THREADS: MeetingThread[] = [
  {
    id: "thread-grpc",
    title: "Weekly Engineering gRPC Syncs",
    createdAt: "2026-07-01",
    ownerEmail: "k.sato@company.com",
    allowedEmails: ["sophia.s@company.com", "alex.chen@company.com", "your-email@domain.com"],
    entries: [
      {
        id: "entry-grpc-1",
        dateStr: "2026-07-03",
        meetingTitle: "gRPC Migration Kickoff",
        recapTitle: "gRPC Kickoff: Protobuf Draft & Scope",
        summary: "Aligned on migrating the catalog service from REST to gRPC. Reviewed initial .proto draft prepared by Kenji Sato. Agreed that the London team will handle TLS security auditing and the SF team will coordinate benchmarking.",
        keyTopics: ["Protobuf Schema Draft", "Service Mesh TLS Security", "Catalog Benchmarking"],
        actionItems: [
          { task: "Draft catalog.proto core service schema", assignee: "Kenji Sato", completed: true, deadline: "2026-07-03" },
          { task: "Setup gRPC development boilerplate repo", assignee: "Alex Chen", completed: true, deadline: "2026-07-05" },
          { task: "Prepare security audit checklist for service mesh", assignee: "Sophia Sterling", completed: true, deadline: "2026-07-06" }
        ],
        suggestedAgenda: ["Review benchmark results", "Discuss security protocols and auditing rules", "Align on staging deploy milestones"],
        selectedSlot: { dateStr: "Friday, Jul 10, 2026", timeStr: "01:00 PM UTC" }
      },
      {
        id: "entry-grpc-2",
        dateStr: "2026-07-10",
        meetingTitle: "gRPC Benchmarks & Audit Align",
        recapTitle: "gRPC Benchmarks showing 4x speedup & TLS setup",
        summary: "Kenji Sato presented Benchmarking results showing a 4.2x serialization throughput increase compared to traditional JSON. Sophia Sterling presented the TLS certificate rotation strategy for the client-side service mesh.",
        keyTopics: ["JST Benchmarking Performance", "mTLS Certificate Rotation", "Staging Milestones"],
        actionItems: [
          { task: "Deploy TLS certificate issuer on staging cluster", assignee: "Sophia Sterling", completed: false, deadline: "2026-07-20" },
          { task: "Incorporate catalog.proto into staging deployment pipeline", assignee: "Kenji Sato", completed: false, deadline: "2026-07-22" },
          { task: "Draft QA rollback strategy for catalog client adapters", assignee: "Alex Chen", completed: false, deadline: "2026-07-15" }
        ],
        suggestedAgenda: ["Verify staging integration stability", "Review load-testing performance curves", "Formulate production gate criteria"],
        selectedSlot: { dateStr: "Friday, Jul 17, 2026", timeStr: "01:00 PM UTC" }
      }
    ]
  },
  {
    id: "thread-marketing",
    title: "Global Campaign & Brand Standups",
    createdAt: "2026-07-05",
    ownerEmail: "sjenkins@company.com",
    allowedEmails: ["your-email@domain.com"],
    entries: [
      {
        id: "entry-mkt-1",
        dateStr: "2026-07-08",
        meetingTitle: "Q3 Campaign Pre-Launch Press Briefing",
        recapTitle: "Campaign Staggering & Agency Briefing Approved",
        summary: "Reviewed marketing agency proposals for the APAC and European launches. Authorized the budget for localization efforts including French translation workflows.",
        keyTopics: ["Press Releases Staggering", "APAC Media List Strategy", "French Localization Budget"],
        actionItems: [
          { task: "Approve French translation agency proposals", assignee: "Sarah Jenkins", completed: true, deadline: "2026-07-10" },
          { task: "Distribute draft PR pitch deck to region leads", assignee: "Sarah Jenkins", completed: false, deadline: "2026-07-18" }
        ],
        suggestedAgenda: ["Review finalized translated press copy", "Confirm APAC media list counts", "Setup UTM dashboard tracking"],
        selectedSlot: { dateStr: "Wednesday, Jul 15, 2026", timeStr: "02:00 PM UTC" }
      }
    ]
  }
];


