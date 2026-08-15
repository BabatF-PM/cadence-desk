import { GoogleGenAI } from '@google/genai';

export interface ActiveMeetingContext {
  rawTranscript?: string;
  extractedTasks?: Array<{ task: string; assignee: string; deadline?: string; priority?: string }>;
  attendees?: Array<{ name: string; locationOrTimezone: string }>;
  proposedSlots?: Array<{ slot: string; score: number; type: 'Gold' | 'Silver' | 'Bronze' | 'Conflict' }>;
}

export const MASTER_SYSTEM_PROMPT = `
================================================================================
CADENCE NAVIGATOR MASTER SYSTEM INSTRUCTIONS
================================================================================
ROLE & IDENTIFICATION:
You are Cadence Navigator, the grounded AI assistant for Cadence Desk. You provide precise, factually strict answers regarding platform architecture, multi-agent pipelines, data security rules, and active meeting session data.

================================================================================
1. PLATFORM ARCHITECTURE, PRIVACY & GUEST ACCESS RULES
================================================================================
- Zero-Cloud Database Architecture: Cadence Desk uses a privacy-first model. Raw meeting transcripts, extracted tasks, and user credentials are NEVER written to Firestore, Cloud Storage, BigQuery, or any remote database.
- Temporary Working Memory: Active meeting transcripts and extracted pipeline data reside EXCLUSIVELY in client-side React browser RAM.
- Mandatory Legal Consent Gate: Users are required to accept the Privacy Policy and Terms of Service via a blocking legal modal before entering the Cadence Desk workspace.
- Consent Audit Tracking: Consent is logged locally on the user's device under cadence_legal_consent_audit in browser localStorage. It records an ISO timestamp, policy version (v1.0-2026), and technical locale (userAgent, clientLocale). No PII or server-side logs are generated.
- Ungated Guest Access: User registration is NOT required to use the workspace, run multi-agent pipelines, or connect email outboxes. Guest users can run all core features in client-side React RAM without logging in after accepting the legal consent modal.
- Guest Workflow Rules:
  * Accept the mandatory blocking legal consent modal upon first entry.
  * Access the workspace immediately without signing in or creating an account, as all core platform features are completely ungated.
  * Paste raw meeting transcripts directly into the workspace to run the full 4-stage multi-agent pipeline inside your browser's RAM.
  * Copy and paste generated recap drafts directly into your email client, or connect your email via Google OAuth or Universal SMTP if you want to send directly from the app.
  * Work securely knowing all meeting context exists purely in volatile client-side RAM and vanishes upon page reload.
- Ungated Outbox Connections: Google OAuth and Universal SMTP connections are ungated and open to all users, including guests.
- Optional Platform Sign-In: Signing in (app_session_user) is purely optional for persistent platform features.
- Official Support & Inquiries: For support, privacy inquiries, or legal notices, contact cadancedesk@gmail.com.
- Session Purge Rules: All active meeting context vanishes permanently upon page reload, tab closure, or clicking "Reset Workspace".
- Storage Matrix (localStorage):
  * cadence_legal_accepted: Confirmation flag ('true') indicating terms and privacy policy acceptance.
  * cadence_legal_consent_audit: On-device JSON audit record storing acceptance timestamp, policy version, and client locale.
  * app_session_user: Primary authentication session token (optional).
  * cadence_smtp_config & google_oauth_token: Saved outbound email credentials.
  * cadence_threads_v1: Recurring thread metadata.

================================================================================
2. THE 4-STAGE MULTI-AGENT PIPELINE
================================================================================
- Total Processing Duration: End-to-end execution typically takes 5 to 10 seconds total.
- Stage 1: Agent Aura (Task Extractor) (~2–3 seconds) - Ingests raw meeting transcripts and distills them into structured action items, assignees, deadlines, and priority levels.
- Stage 2: Agent Chronos (Timezone Optimizer) (~1 second) - Standardizes attendee timezones to UTC and evaluates slot overlaps using an algorithmic scoring system:
  * Gold: +10 points
  * Silver: +5 points
  * Sleeping: -15 points
  * Conflict: -100 points
  Pauses execution at the Decision Desk for PM confirmation.
-- Stage 3: Agent Scribe (Comms Specialist) (~2–3 seconds) - Drafts executive recap emails combining tasks and schedules while enforcing a body cap under 1,600 characters for mailto: link compatibility.
- Stage 4: Outbox Transport Gateway (Instant / < 1 second) - Dispatches outbound recaps via Google OAuth or Universal SMTP (Office365, Yahoo, custom) under a strict 2,000-character total payload limit.


================================================================================
3. WORKSPACE LIFECYCLE & SECURITY CONTROLS
================================================================================
- Reset Workspace: Clears transient meeting pipeline outputs in browser RAM (transcripts, tasks, slots, email drafts) while maintaining active user login and saved outbound mail settings.
- Log Out: Performs a total security wipe, removing primary session tokens (app_session_user) and deleting all saved outbox credentials (cadence_smtp_config, google_oauth_token) from localStorage.
- Ungated Operations: Guests can execute all agent pipeline steps and connect email outboxes without needing to authenticate or create an account.

================================================================================
4. MASTER RESOLUTION LOGS & RESILIENCE ENGINE
================================================================================
- Issue #18 (Rate Limits & 503 Spikes): Mitigated upstream Gemini API 503 errors using a 3x retry loop with exponential backoff (2^x * 1000ms + jitter) and an offline local regex parser fallback engine.
- Issue #26 (Payload Truncation): Enforced strict 1,600 body / 2,000 transport character caps to prevent link clipping.
- Issue #27 (Email Bounces): Implemented pre-dispatch validation checks to block invalid placeholder domains (@company.com).

================================================================================
5. DYNAMIC WORKSPACE & TRANSCRIPT QUERYING DIRECTIVES
================================================================================
- Live Context Rule: When a user asks about current transcript details, attendees, assigned tasks, or timezone overlaps, answer strictly using the provided active context block.
- Missing Data Guardrail: If queried information (person, task, budget, date) is NOT present in the provided transcript or workspace data, explicitly state that it does not exist in the currently loaded meeting context.
- Format & Tone:
  1. Direct Start: Begin answers immediately with the factual answer without conversational setup or lead-in phrases (e.g., avoid "Here is the breakdown:").
  2. Concise Brevity: Limit explanations to 3-5 scannable bullet points maximum.
  3. Completeness: Ensure all sentences and formatting blocks close cleanly.
`;

// Local offline fallback grounded response generator
function getLocalGroundedResponse(query: string, meetingContext?: ActiveMeetingContext): string {
  const lower = query.toLowerCase();

  // Handle active session queries in offline mode
  if (meetingContext && (lower.includes("task") || lower.includes("assignee") || lower.includes("who") || lower.includes("action") || lower.includes("transcript") || lower.includes("slot") || lower.includes("attendee"))) {
    let response = `### **Active Session Context (Live React RAM)**\n\n`;
    if (lower.includes("task") || lower.includes("assignee") || lower.includes("action")) {
      if (meetingContext.extractedTasks && meetingContext.extractedTasks.length > 0) {
        response += `* **Extracted Tasks (${meetingContext.extractedTasks.length})**:\n`;
        meetingContext.extractedTasks.forEach((t, i) => {
          response += `  ${i + 1}. **${t.task}** — Assignee: \`${t.assignee}\`${t.deadline ? ` (Deadline: ${t.deadline})` : ''}\n`;
        });
      } else {
        response += `* **Extracted Tasks**: No tasks extracted in current session.\n`;
      }
    }

    if (lower.includes("attendee") || lower.includes("who") || lower.includes("timezone")) {
      if (meetingContext.attendees && meetingContext.attendees.length > 0) {
        response += `* **Attendees (${meetingContext.attendees.length})**:\n`;
        meetingContext.attendees.forEach(a => {
          response += `  - **${a.name}**: ${a.locationOrTimezone}\n`;
        });
      } else {
        response += `* **Attendees**: No attendees registered in current session.\n`;
      }
    }

    if (lower.includes("slot") || lower.includes("time") || lower.includes("schedule")) {
      if (meetingContext.proposedSlots && meetingContext.proposedSlots.length > 0) {
        response += `* **Proposed Time Slots (${meetingContext.proposedSlots.length})**:\n`;
        meetingContext.proposedSlots.forEach(s => {
          response += `  - **${s.type}**: ${s.slot} (Score: ${s.score})\n`;
        });
      } else {
        response += `* **Proposed Slots**: No timezone slots calculated yet.\n`;
      }
    }

    if (lower.includes("transcript")) {
      if (meetingContext.rawTranscript) {
        const snippet = meetingContext.rawTranscript.slice(0, 200);
        response += `* **Transcript Snippet**: "${snippet}${meetingContext.rawTranscript.length > 200 ? '...' : ''}"\n`;
      } else {
        response += `* **Transcript**: No raw transcript loaded in workspace.\n`;
      }
    }

    response += `\n*Privacy Notice*: This data lives strictly in browser RAM and is discarded on refresh or Reset Workspace.`;
    return response;
  }

  if (lower.includes("support") || lower.includes("contact") || lower.includes("email") || lower.includes("help") || lower.includes("reach")) {
    return `### **Support & Contact Information**

For platform support, privacy questions, technical assistance, or legal inquiries regarding Cadence Desk, please contact:
* **Official Support Email**: **cadancedesk@gmail.com**

*Note*: Cadence Desk operates on a Zero-Cloud architecture. Technical issues can also be checked via the in-app Cadence Navigator chat.`;
  }

  if (lower.includes("storage") || lower.includes("database") || lower.includes("cloud") || lower.includes("where is my data") || lower.includes("privacy") || lower.includes("consent") || lower.includes("terms") || lower.includes("legal")) {
    return `### **Data Storage, Privacy & Legal Consent Architecture**

Cadence Desk operates on a strict **Zero Centralized Cloud Storage** architecture:
* **Mandatory Legal Consent Gate**: Users must explicitly accept the Terms of Service and Privacy Policy via a blocking legal modal before entering the workspace.
* **On-Device Consent Audit**: Consent is logged locally under \`cadence_legal_consent_audit\` in browser \`localStorage\` recording an ISO timestamp, policy version (\`v1.0-2026\`), and client locale. No PII or server-side logs are generated.
* **No Cloud Database**: Transcripts, tasks, and credentials are **never** stored in Firestore, BigQuery, or Google Cloud.
* **Temporary Working Memory**: Active transcripts and agent outputs reside strictly in **browser RAM** and are wiped on page refresh or clicking **Reset Workspace**.
* **Browser Local Storage (\`localStorage\`)**:
  * \`cadence_legal_accepted\`: Legal terms acceptance status flag (\`true\`).
  * \`cadence_legal_consent_audit\`: On-device audit record for terms & privacy acceptance.
  * \`app_session_user\`: Active auth session token (optional).
  * \`cadence_smtp_config\` & \`google_oauth_token\`: Outbound mail settings.
  * \`cadence_threads_v1\`: Recurring meeting threads history.
* **Secure Transit**: Transcripts are passed transiently over encrypted HTTPS for AI extraction and discarded immediately after response generation.`;
  }

  if (lower.includes("agent") || lower.includes("aura") || lower.includes("chronos") || lower.includes("scribe") || lower.includes("pipeline") || lower.includes("stage")) {
    return `### **4-Stage Multi-Agent Pipeline**

Cadence Desk automates post-meeting operational friction through 4 sequential agent stages:
1. **Stage 1: Agent Aura (Task Extractor)** – Distills raw meeting transcripts into structured action items, assignees, deadlines, and priority levels.
2. **Stage 2: Agent Chronos (Timezone Optimizer)** – Normalizes multi-region working hours to UTC across attendees. Scores potential slots (**Gold: +10**, **Silver: +5**, **Sleeping: -15**, **Conflict: -100**) for the Decision Desk.
3. **Stage 3: Agent Scribe (Comms Specialist)** – Drafts structured Markdown executive recap emails combining tasks and selected time slots (< 1,600 chars for mailto compatibility).
4. **Stage 4: Outbox Transport Gateway** – Dispatches outbound emails via Google OAuth or Universal SMTP with a 2,000-character payload cap and live execution logging.`;
  }

  if (lower.includes("register") || lower.includes("sign in") || lower.includes("account") || lower.includes("login") || lower.includes("log in") || lower.includes("guest") || lower.includes("registered user") || lower.includes("need to be") || lower.includes("how do i use") || lower.includes("how to use")) {
    return `### **Guest Workflow & Authentication Policy**

* Access the workspace immediately without signing in or creating an account, as all core platform features are completely ungated.
* Paste raw meeting transcripts directly into the workspace to run the full 4-stage multi-agent pipeline inside your browser's RAM.
* Copy and paste generated recap drafts directly into your email client, or connect your email via Google OAuth or Universal SMTP if you want to send directly from the app.
* Work securely knowing all meeting context exists purely in volatile client-side RAM and vanishes upon page reload.`;
  }

  if (lower.includes("reset") || lower.includes("logout") || lower.includes("log out") || lower.includes("security") || lower.includes("lifecycle")) {
    return `### **Security & Workspace Lifecycle Rules**

* **Ungated Access**: User registration is NOT required. Guests can run multi-agent pipelines and connect Google OAuth or Universal SMTP outboxes freely without an account.
* **"Reset Workspace" Action**: Clears all transient meeting outputs (transcripts, drafts, time slots) in browser RAM while preserving active login sessions and saved email connections.
* **"Log Out" Action**: Executes a complete security wipe, purging user profiles, session tokens, and saved Outbox credentials from \`localStorage\`.
* **Gemini API Resilience Engine**: Employs a 3x retry loop with exponential backoff ($2^x \\times 1000\\text{ms} + \\text{jitter}$) and falls back to an internal Offline Smart Regex Parser if connectivity fails.`;
  }

  if (lower.includes("issue") || lower.includes("bug") || lower.includes("18") || lower.includes("26") || lower.includes("27") || lower.includes("test")) {
    return `### **Master Test Tracker & Issue History**

* **Issue #18 (Gemini 503 Overload)**: Resolved by building an exponential backoff retry loop with random jitter and an automated offline regex fallback parser.
* **Issue #26 (In-App Support Chatbot)**: Integrated the floating \`SynchronChatbot\` component powered by Gemini Flash grounding and local fallback rule sets.
* **Issue #27 (Email Delivery Timeout / Bounce)**: Resolved domain dispatch failures on \`@company.com\` by implementing pre-dispatch placeholder email validation checks and blocking invalid addresses prior to transmission.`;
  }

  return `### **Cadence Navigator Guidance**

Cadence Desk is an autonomous multi-agent workspace for post-meeting execution:
* **Stage 1 (Aura)**: Distills action items & assignees.
* **Stage 2 (Chronos)**: Calculates multi-region timezone overlaps (Gold, Silver, Bronze slots).
* **Stage 3 (Scribe)**: Constructs executive Markdown email recaps.
* **Stage 4 (Outbox Gateway)**: Dispatches email payloads via Google OAuth or Universal SMTP.

*Privacy Note*: All data resides locally in browser RAM or \`localStorage\`. No cloud database is used. How can I help you with the architecture or setup?`;
}

export async function askGroundedAssistant(
  userQuestion: string,
  meetingContext?: ActiveMeetingContext
): Promise<string> {
  const dynamicContextBlock = meetingContext ? `
================================================================================
ACTIVE LOADED MEETING TRANSCRIPT & PIPELINE DATA (LIVE REACT RAM)
================================================================================
RAW TRANSCRIPT:
${meetingContext.rawTranscript || 'No transcript uploaded in active workspace.'}

EXTRACTED TASKS & ASSIGNEES (AGENT AURA):
${JSON.stringify(meetingContext.extractedTasks || [], null, 2)}

ATTENDEES & TIMEZONES:
${JSON.stringify(meetingContext.attendees || [], null, 2)}

PROPOSED TIME SLOTS & SCORES (AGENT CHRONOS):
${JSON.stringify(meetingContext.proposedSlots || [], null, 2)}
` : '\n[No active meeting context loaded]';

  const FULL_SYSTEM_INSTRUCTION = `${MASTER_SYSTEM_PROMPT}\n${dynamicContextBlock}`;

  // Direct Gemini SDK execution if API key is present
  try {
    const apiKey =
      (typeof process !== "undefined" && process.env?.REACT_APP_GEMINI_API_KEY) ||
      (typeof process !== "undefined" && process.env?.GEMINI_API_KEY) ||
      (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
      '';

    if (apiKey) {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: userQuestion }] }],
        config: {
          systemInstruction: FULL_SYSTEM_INSTRUCTION,
          temperature: 0.1,
          maxOutputTokens: 1200,
        },
      });

      if (response && response.text) {
        return response.text;
      }
    }
  } catch (error) {
    console.warn("Gemini Client Error, using offline grounded rule engine:", error);
  }

  // Guaranteed zero-latency grounded fallback knowledge base
  return getLocalGroundedResponse(userQuestion, meetingContext);
}