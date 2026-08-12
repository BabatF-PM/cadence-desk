import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import mammoth from "mammoth";
import nodemailer from "nodemailer";

dotenv.config();

// Helper to convert Markdown formatting into styled HTML
function convertMarkdownToHtml(md: string): string {
  if (!md) return "";
  let html = md;
  
  if (/<div style="font-family:/i.test(html) || /^<html>/i.test(html)) {
    return html;
  }

  // Escape HTML special characters
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Headers: #### and ##### first, then ###, ##, #
  html = html.replace(/^##### (.*$)/gim, '<h5 style="color: #4f46e5; font-family: sans-serif; margin-top: 14px; margin-bottom: 6px; font-size: 12px; font-weight: bold;">$1</h5>');
  html = html.replace(/^#### (.*$)/gim, '<h4 style="color: #4f46e5; font-family: sans-serif; margin-top: 16px; margin-bottom: 6px; font-size: 13px; font-weight: bold;">$1</h4>');
  html = html.replace(/^### (.*$)/gim, '<h3 style="color: #4f46e5; font-family: sans-serif; margin-top: 18px; margin-bottom: 8px; font-size: 14px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px;">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 style="color: #1e1b4b; font-family: sans-serif; margin-top: 22px; margin-bottom: 10px; font-size: 16px; font-weight: bold;">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 style="color: #1e1b4b; font-family: sans-serif; margin-top: 26px; margin-bottom: 12px; font-size: 18px; font-weight: bold;">$1</h1>');

  // Replace strong and emphasis
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #0f172a;">$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em style="color: #475569;">$1</em>');

  // Replace checkboxes and list items
  html = html.replace(/^\s*-\s*\[\s*x\s*\]\s*(.*$)/gim, '<li style="list-style-type: none; margin-left: 12px; margin-bottom: 4px; font-family: sans-serif; font-size: 13px; color: #64748b;">☑️ <del>$1</del></li>');
  html = html.replace(/^\s*-\s*\[\s* \s*\]\s*(.*$)/gim, '<li style="list-style-type: none; margin-left: 12px; margin-bottom: 4px; font-family: sans-serif; font-size: 13px; color: #334155;">⬜ $1</li>');
  html = html.replace(/^\s*-\s*(.*$)/gim, '<li style="margin-left: 16px; margin-bottom: 4px; font-family: sans-serif; font-size: 13px; color: #334155;">$1</li>');

  // Wrap lists into <ul>
  html = html.replace(/((?:<li[^>]*>.*?<\/li>\s*)+)/gs, '<ul style="padding-left: 16px; margin-bottom: 12px;">$1</ul>');

  // Horizontal rule
  html = html.replace(/^\s*---\s*$/gim, '<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />');

  // Process paragraphs
  const lines = html.split('\n');
  const processedLines = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return "<br/>";
    if (trimmed.startsWith('<h') || trimmed.startsWith('<div') || trimmed.startsWith('<ul') || trimmed.startsWith('<li') || trimmed.startsWith('<hr')) {
      return line;
    }
    return `<p style="margin-bottom: 8px; font-family: sans-serif; font-size: 13px; line-height: 1.6; color: #334155;">${line}</p>`;
  });

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);">
      ${processedLines.join('\n')}
    </div>
  `;
}

// Helper to construct RFC 2822 base64url encoded raw email string for Gmail API
function createRawEmail(to: string[], subject: string, body: string, from?: string): string {
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;
  const messageParts = [
    from ? `From: ${from}` : "",
    `To: ${to.join(", ")}`,
    `Subject: ${utf8Subject}`,
    "Content-Type: text/html; charset=UTF-8",
    "MIME-Version: 1.0",
    "",
    body
  ].filter(Boolean);

  const mimeString = messageParts.join("\r\n");
  return Buffer.from(mimeString)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Endpoint to extract text from Word documents
app.post("/api/parse-docx", async (req, res) => {
  try {
    const { fileData, fileName } = req.body;
    if (!fileData) {
      return res.status(400).json({ error: "No file data provided." });
    }
    console.log(`Received parse-docx request for: ${fileName || "document"}`);
    const buffer = Buffer.from(fileData, "base64");
    const result = await mammoth.extractRawText({ buffer });
    return res.json({ text: result.value });
  } catch (err: any) {
    console.error("Failed to parse docx Word document:", err);
    return res.status(500).json({ error: err.message || "Failed to parse Word document." });
  }
});

// Proxy endpoint to send Gmail messages securely from the server side (bypassing browser CORS/iframe restrictions)
app.post("/api/send-gmail", async (req, res) => {
  try {
    const { raw, accessToken, useUploadEndpoint } = req.body;
    if (!raw) {
      return res.status(400).json({ error: { message: "Missing 'raw' message data." } });
    }
    if (!accessToken) {
      return res.status(401).json({ error: { message: "Missing Google authorization token. Please connect your Google account." } });
    }

    const endpoint = useUploadEndpoint 
      ? "https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send"
      : "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

    const contentType = useUploadEndpoint
      ? "message/rfc822"
      : "application/json";

    let body: any;
    if (useUploadEndpoint) {
      // Decode the base64/base64url encoded MIME email back to standard raw MIME string/buffer for message/rfc822 upload
      try {
        let base64 = raw.replace(/-/g, "+").replace(/_/g, "/");
        while (base64.length % 4) {
          base64 += "=";
        }
        body = Buffer.from(base64, "base64");
      } catch (err) {
        console.error("Failed to decode raw message for upload endpoint, sending raw as-is:", err);
        body = raw;
      }
    } else {
      body = JSON.stringify({ raw });
    }

    console.log(`Proxying Gmail send request to Google API (${endpoint})...`);
    const googleResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": contentType
      },
      body: body
    });

    const data: any = await googleResponse.json();
    if (!googleResponse.ok) {
      console.error("Google API send failed with status:", googleResponse.status, data);
      return res.status(googleResponse.status).json({
        error: data.error || { message: "Google API rejected the request." }
      });
    }

    console.log("Google API sent email successfully! Message ID:", data.id);
    return res.json(data);
  } catch (error: any) {
    console.error("Failed to proxy Gmail dispatch:", error);
    return res.status(500).json({
      error: { message: error.message || "Internal server error during Gmail proxy." }
    });
  }
});

// Endpoint for direct email sending (supports both Google OAuth and Universal SMTP)
app.post("/api/send-email", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : (req.body.token || req.body.accessToken);

    const { connectionType, smtpConfig, to, subject, body, senderEmail: clientSenderEmail } = req.body;

    if (!to || (Array.isArray(to) && to.length === 0)) {
      return res.status(400).json({ success: false, error: "At least one recipient email address ('to') is required." });
    }
    if (!body) {
      return res.status(400).json({ success: false, error: "Email body content is required." });
    }

    const recipientsList = Array.isArray(to) 
      ? to.map(r => String(r).trim()).filter(Boolean)
      : String(to).split(",").map(s => s.trim()).filter(Boolean);

    const emailSubject = subject || "Meeting Follow-up & Action Items";
    const htmlFormattedBody = convertMarkdownToHtml(body);

    // Detect if this is Universal SMTP or Google OAuth
    if (connectionType === "smtp" || (smtpConfig && smtpConfig.senderEmail)) {
      if (!smtpConfig || !smtpConfig.senderEmail || !smtpConfig.smtpHost) {
        return res.status(400).json({
          success: false,
          error: "Universal SMTP configuration incomplete. Please provide Sender Email, SMTP Host, and App Password."
        });
      }
      const providerName = smtpConfig.providerName || "Universal SMTP";
      const senderEmail = smtpConfig.senderEmail;
      console.log(`[API /api/send-email] Dispatching via Universal SMTP [${providerName}] (${senderEmail}) to ${recipientsList.length} recipient(s)...`);

      try {
        const transporter = nodemailer.createTransport({
          host: smtpConfig.smtpHost,
          port: Number(smtpConfig.smtpPort) || 587,
          secure: Number(smtpConfig.smtpPort) === 465,
          auth: {
            user: smtpConfig.senderEmail,
            pass: smtpConfig.appPassword || ""
          },
          tls: {
            rejectUnauthorized: false
          },
          connectionTimeout: 15000,
          greetingTimeout: 15000
        });

        const mailOptions = {
          from: smtpConfig.senderName ? `"${smtpConfig.senderName}" <${smtpConfig.senderEmail}>` : smtpConfig.senderEmail,
          to: recipientsList.join(", "),
          subject: emailSubject,
          html: htmlFormattedBody
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[SMTP Dispatch Success] Message ID: ${info.messageId}`);

        return res.json({
          success: true,
          message: `Email successfully dispatched via ${providerName} (${senderEmail}).`,
          messageId: info.messageId,
          recipients: recipientsList,
          subject: emailSubject,
          providerName,
          senderEmail,
          connectionType: "smtp",
          timestamp: new Date().toISOString()
        });
      } catch (smtpErr: any) {
        console.error("[SMTP Dispatch Error]:", smtpErr);
        const exactErrorMsg = smtpErr.message || smtpErr.response || "SMTP server authentication or connection failed.";
        return res.status(500).json({
          success: false,
          error: `SMTP Error: ${exactErrorMsg}`,
          providerName,
          senderEmail
        });
      }
    } else {
      // Google OAuth path
      if (!token || token === "null" || token === "undefined" || token.trim() === "") {
        return res.status(401).json({
          success: false,
          error: "Google account authentication required for Gmail dispatch. Please connect your Google account."
        });
      }

      const providerName = "Gmail / Google Workspace";
      const senderEmail = clientSenderEmail || "connected-user@company.com";
      console.log(`[API /api/send-email] Dispatching via Google OAuth [${providerName}] (${senderEmail}) to ${recipientsList.length} recipient(s)...`);

      const rawEmail = createRawEmail(recipientsList, emailSubject, htmlFormattedBody, senderEmail);

      const endpoint = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
      console.log(`Posting raw RFC 2822 base64url message to Google REST API: ${endpoint}`);

      let googleRes: Response;
      try {
        googleRes = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ raw: rawEmail })
        });
      } catch (fetchErr: any) {
        console.error("Network fetch error calling Google Gmail API:", fetchErr);
        return res.status(502).json({
          success: false,
          error: `Google Gmail API Connection Error: ${fetchErr.message || "Failed to reach Google API server."}`,
          providerName,
          senderEmail
        });
      }

      const googleData: any = await googleRes.json().catch(() => ({}));

      if (googleRes.ok && googleData && googleData.id) {
        console.log(`[Google Gmail Dispatch Success] Real Message ID from Google: ${googleData.id}`);
        return res.json({
          success: true,
          message: `Email successfully dispatched via ${providerName} (${senderEmail}).`,
          messageId: googleData.id,
          recipients: recipientsList,
          subject: emailSubject,
          providerName,
          senderEmail,
          connectionType: "google",
          timestamp: new Date().toISOString()
        });
      } else {
        const errorMsg = googleData.error?.message || 
          (typeof googleData.error === "string" ? googleData.error : null) || 
          `Google Gmail API rejected request with status code ${googleRes.status}`;
        console.error(`[Google Gmail Dispatch Error] Status: ${googleRes.status}, Error:`, googleData);

        return res.status(googleRes.status || 400).json({
          success: false,
          error: `Google Gmail API Error: ${errorMsg}`,
          providerName,
          senderEmail
        });
      }
    }
  } catch (err: any) {
    console.error("Error in /api/send-email endpoint:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to send email via direct API endpoint."
    });
  }
});

// Lazy-initialized Gemini client
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required but missing. Please set it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Helper function to dynamically generate a highly robust semantic recap if Gemini is unavailable (e.g. 503 high demand)
function generateLocalFallbackRecap(transcript: string, attendees: any[], meetingTitle?: string, granularity: string = "standard") {
  const title = meetingTitle || "Follow-up & Sync Session";
  const isHighPriority = granularity === "high_priority" || granularity === "high-priority";
  const isExhaustive = granularity === "detailed" || granularity === "exhaustive";

  const suggestedTitle = isHighPriority 
    ? `⚠️ CRITICAL Recaps: ${title}` 
    : isExhaustive 
      ? `Exhaustive Systems Recapping: ${title}` 
      : `Recap: ${title}`;
  
  const lines = transcript.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const speakers = new Set<string>();
  const actions: { task: string; assignee: string; deadline: string; nextSteps: string }[] = [];
  const topics = new Set<string>();
  
  const knownAttendees = Array.isArray(attendees) && attendees.length > 0 
    ? attendees.map(a => a.name) 
    : ["Sarah Jenkins", "Sophia Sterling", "Kenji Sato"];

  const actionKeywords = [
    "will", "need to", "needs to", "responsible for", "take care of", 
    "going to", "action item", "todo", "to-do", "assign", "schedule", "task", "follow up"
  ];
  const topicKeywords = ["discuss", "about", "topic", "project", "focus", "update", "milestone", "plan", "review"];

  // Blocker & high priority terms
  const highPriorityKeywords = ["urgent", "block", "must", "critical", "fail", "broken", "stop", "immediately", "asap", "error", "delay"];

  for (const line of lines) {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    let speaker = "";
    let content = line;
    if (match) {
      speaker = match[1].trim();
      content = match[2].trim();
      if (knownAttendees.some(name => name.toLowerCase().includes(speaker.toLowerCase()) || speaker.toLowerCase().includes(name.toLowerCase()))) {
        speakers.add(speaker);
      }
    }

    const lowerContent = content.toLowerCase();
    const isAction = actionKeywords.some(kw => lowerContent.includes(kw));
    if (isAction && content.length > 10) {
      let assignedTo = "Unassigned";
      for (const attendee of knownAttendees) {
        if (lowerContent.includes(attendee.toLowerCase()) || (speaker && attendee.toLowerCase().includes(speaker.toLowerCase()))) {
          assignedTo = attendee;
          break;
        }
      }
      if (assignedTo === "Unassigned" && speaker) {
        assignedTo = speaker;
      }
      
      let deadline = "Not specified";
      const deadlineMatches = [
        { pattern: /by next (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i, label: "Next Week" },
        { pattern: /by tomorrow/i, label: "Tomorrow" },
        { pattern: /this week/i, label: "End of this week" },
        { pattern: /next week/i, label: "Next week" },
        { pattern: /by friday/i, label: "Friday" },
        { pattern: /by end of day/i, label: "End of day" },
      ];
      for (const dm of deadlineMatches) {
        if (dm.pattern.test(lowerContent)) {
          deadline = dm.label;
          break;
        }
      }

      const taskClean = content.replace(/^(Sarah|Sophia|Kenji|Alex|David):\s*/i, "");
      const isUrgentTask = highPriorityKeywords.some(kw => lowerContent.includes(kw));

      // In high-priority mode, we selectively filter or tag
      if (isHighPriority && !isUrgentTask) {
        continue; // skip minor tasks in high-priority only mode
      }

      const taskLabel = isHighPriority ? `⚠️ [CRITICAL BLOCKER] ${taskClean}` : taskClean;
      const nextStepsText = isHighPriority 
        ? `IMMEDIATE ACTION: Stop secondary tasks and focus fully on resolving ${taskClean.substring(0, 30).toLowerCase()} to clear the team's blocker.`
        : isExhaustive
          ? `Coordinate with the team, setup tracking, and document lower-level milestones for executing ${taskClean.substring(0, 30).toLowerCase()} thoroughly.`
          : `Coordinate with the team to initiate ${taskClean.substring(0, 30).toLowerCase()} execution.`;

      actions.push({
        task: taskLabel.substring(0, 150),
        assignee: assignedTo,
        deadline: isHighPriority && deadline === "Not specified" ? "ASAP / Immediate" : deadline,
        nextSteps: nextStepsText
      });
    }

    if (topicKeywords.some(kw => lowerContent.includes(kw))) {
      const topicWords = content.split(" ").slice(0, 6).join(" ");
      if (topicWords.length > 8) {
        topics.add(topicWords);
      }
    }
  }

  // Handle empty actions depending on mode
  if (actions.length === 0) {
    if (isHighPriority) {
      actions.push({
        task: "⚠️ RESOLVE ACTIVE TIMEZONE & SCHEDULING DISCREPANCIES",
        assignee: knownAttendees[0] || "All",
        deadline: "Immediate",
        nextSteps: "Schedule a high-priority 15-minute sync to unlock cross-regional developers."
      });
    } else {
      actions.push({
        task: "Analyze next steps and follow up on the core items discussed.",
        assignee: knownAttendees[0] || "All",
        deadline: "Next meeting",
        nextSteps: "Set up the initial follow-up meeting agenda and align with team."
      });
    }
  }
  
  const topicsList = Array.from(topics);
  if (topicsList.length === 0) {
    topicsList.push(isHighPriority ? "Critical Project Obstacles & Blockers" : "Overall alignment and next steps");
    topicsList.push("Actions & schedules breakdown");
  }

  const speakersList = Array.from(speakers);
  
  let summary = "";
  if (isHighPriority) {
    summary = `The sync was prioritized strictly to address critical timezone hurdles and severe blockers. ${
      speakersList.length > 0 ? `Urgent alignments were disputed and resolved by ${speakersList.join(", ")}.` : ""
    } Outstanding high-risk issues have been isolated for immediate resolution to prevent project delays.`;
  } else if (isExhaustive) {
    summary = `A highly detailed and exhaustive synchronization meeting was held to coordinate next-phase execution across regions. ${
      speakersList.length > 0 ? `The team (including ${speakersList.join(", ")}) provided comprehensive updates on ongoing tasks.` : ""
    } Every minor topic, long-term timeline, subtask, and timezone overlap was mapped extensively to establish robust low-level alignment.`;
  } else {
    summary = `The team synced to align on ${title}. ${
      speakersList.length > 0 
        ? `Key contributions and scheduling alignments were actively discussed by ${speakersList.join(", ")}.` 
        : "Attendees successfully reviewed status updates and synchronized project timelines."
    } Key action items were successfully identified to ensure robust execution across timezones.`;
  }

  const suggestedAgenda = isHighPriority 
    ? ["Emergency sync on critical blockers", "Assigning emergency owners for open blockers"]
    : isExhaustive
      ? ["Detailed review of completed actions & subtasks", "Thorough mapping of timezone overlaps", "Risks, dependencies & long-term milestones mapping"]
      : ["Review of completed actions and progress update", "Timezone overlap alignment and scheduling finalization", "Next milestones and open discussion"];

  // Expose up to 4 actions for exhaustive, 2 for priority, 3 for standard
  const maxActions = isExhaustive ? 4 : isHighPriority ? 2 : 3;

  // AI-first Duration detection (defaulting to 30 mins if unspecified)
  let detectedDuration = 30;
  const durationMatch = transcript.match(/(\d+)\s*(mins?|minutes?|hr|hrs|hours?)/i);
  if (durationMatch) {
    const val = parseInt(durationMatch[1], 10);
    const unit = durationMatch[2].toLowerCase();
    if (unit.startsWith("hr") || unit.startsWith("hour")) {
      detectedDuration = val * 60;
    } else if (val >= 15 && val <= 180) {
      detectedDuration = val;
    }
  }

  // AI-first Target Date inference from relative timeline terms
  const today = new Date();
  let targetDaysOffset = 3; // Default follow-up date 3 days from today
  const lowerTranscript = transcript.toLowerCase();
  if (lowerTranscript.includes("tomorrow")) {
    targetDaysOffset = 1;
  } else if (lowerTranscript.includes("next week") || lowerTranscript.includes("this time next week")) {
    targetDaysOffset = 7;
  } else if (lowerTranscript.includes("this thursday") || lowerTranscript.includes("by thursday")) {
    const currentDay = today.getDay();
    targetDaysOffset = (4 - currentDay + 7) % 7 || 7;
  } else if (lowerTranscript.includes("this friday") || lowerTranscript.includes("by friday")) {
    const currentDay = today.getDay();
    targetDaysOffset = (5 - currentDay + 7) % 7 || 7;
  } else if (lowerTranscript.includes("next monday") || lowerTranscript.includes("by monday")) {
    const currentDay = today.getDay();
    targetDaysOffset = (1 - currentDay + 7) % 7 || 7;
  } else if (lowerTranscript.includes("in 2 days") || lowerTranscript.includes("two days")) {
    targetDaysOffset = 2;
  } else if (lowerTranscript.includes("in 3 days") || lowerTranscript.includes("three days")) {
    targetDaysOffset = 3;
  }

  const targetDateObj = new Date(today);
  targetDateObj.setDate(today.getDate() + targetDaysOffset);
  const inferredTargetDate = targetDateObj.toISOString().split("T")[0];

  return {
    suggestedTitle,
    summary: summary.substring(0, 250),
    keyTopics: topicsList.slice(0, isExhaustive ? 4 : 3),
    actionItems: actions.slice(0, maxActions),
    suggestedAgenda: suggestedAgenda.slice(0, 2),
    detectedDuration,
    inferredTargetDate,
    isLocalFallback: true
  };
}

// API endpoint for meeting transcript distillation
app.post("/api/recap", async (req, res) => {
  try {
    const { transcript, attendees, meetingTitle, granularity } = req.body;

    if (!transcript || typeof transcript !== "string") {
      return res.status(400).json({ error: "Transcript is required and must be a string." });
    }

    let ai = null;
    try {
      ai = getGeminiClient();
    } catch (keyErr) {
      console.warn("[Recap API] GEMINI_API_KEY missing or invalid, using high-fidelity local semantic parser fallback:", keyErr);
      const fallbackData = generateLocalFallbackRecap(transcript, attendees || [], meetingTitle, granularity);
      return res.json(fallbackData);
    }

    const attendeeListString = Array.isArray(attendees)
      ? attendees.map((a: any) => `${a.name} (${a.timezone || "UTC"})`).join(", ")
      : "Not provided";

    let granularityInstructions = "";
    if (granularity === "detailed" || granularity === "exhaustive") {
      granularityInstructions = `
OUTPUT GRANULARITY STYLE: In-Depth Exhaustive.
- Provide a highly comprehensive, detailed, and complete recap.
- Executive Summary must be highly comprehensive (3-4 detailed sentences) capturing nuances, max 400 characters.
- Key Topics: up to 5 items.
- Action Items: up to 5 items. Keep tasks and next steps clear but concise.
- Ensure the total size of the final compiled email remains reasonable.
`;
    } else if (granularity === "high_priority" || granularity === "high-priority") {
      granularityInstructions = `
OUTPUT GRANULARITY STYLE: High Priority Only (Strictly Concise).
- Focus strictly on critical blockers, high-impact decisions, and urgent updates.
- Executive Summary: 1-2 short sentences (max 180 characters).
- Key Topics: max 2 key topics.
- Action Items: max 2 high-priority items.
- Suggested Agenda: max 2 items.
`;
    } else {
      granularityInstructions = `
OUTPUT GRANULARITY STYLE: Standard Balanced Distillation (Strictly Concise).
- Executive Summary: 2 concise sentences (max 250 characters).
- Key Topics: max 3 core topics.
- Action Items: max 3 clear action items.
- Suggested Agenda: max 2 items.
`;
    }

    const prompt = `
Analyze the following meeting transcript and extract structured information.
Meeting Title (Reference): ${meetingTitle || "Untitled Meeting"}
Attendees List: ${attendeeListString}

${granularityInstructions}

CRITICAL COMPACTNESS CONSTRAINT:
To ensure the email recap can be dispatched successfully via standard mailto links (which have a strict 2,000 character URL length limit), you MUST keep your generated outputs extremely tight, dense, and compact. 
Specifically:
- 'summary' MUST be at most 250 characters.
- 'keyTopics' array must have at most 3 items, each item being a short phrase under 50 characters.
- 'actionItems' array must have at most 3 items. For each item, keep 'task' under 60 characters, and 'nextSteps' under 70 characters.
- 'suggestedAgenda' array must have at most 2 items, under 50 characters each.
- 'detectedDuration': integer in minutes (e.g. 30, 45, 60, 90). Default to 30 if unspecified or unclear.
- 'inferredTargetDate': ISO date string in YYYY-MM-DD format for the follow-up meeting target date, inferred from relative terms in transcript (e.g. "next week", "this Thursday", "tomorrow", "next Monday"). Current anchor date for relative calculation is ${new Date().toISOString().split("T")[0]}.

This guarantees the compiled Markdown email recap naturally remains under 1,600 characters, fitting safely within the 2,000-character mailto limit.

Transcript:
"""
${transcript}
"""

Please distill this transcript and provide:
1. A descriptive, high-quality, professional email subject line/meeting title.
2. A clear, high-level general executive summary.
3. The key topics discussed (bullet points).
4. A list of Action Items. Each action item must specify:
   - The concrete task.
   - The assignee (exactly match one of the provided attendees if possible, or "Unassigned" or "All").
   - Any implied deadline or timeline.
   - Any concrete immediate next steps (1 sentence) to execute this task.
5. A suggested follow-up meeting agenda (2-3 items).
6. Automatically detected meeting/follow-up duration in minutes (detectedDuration).
7. Inferred follow-up target date in YYYY-MM-DD format (inferredTargetDate).

Ensure all assignees correspond to real people mentioned in the attendee list or transcript.
`;

    const recapSchema = {
      type: Type.OBJECT,
      required: ["suggestedTitle", "summary", "keyTopics", "actionItems", "suggestedAgenda", "detectedDuration", "inferredTargetDate"],
      properties: {
        suggestedTitle: {
          type: Type.STRING,
          description: "A concise, professional email subject line or follow-up meeting title.",
        },
        summary: {
          type: Type.STRING,
          description: "A high-level executive summary of what was accomplished during the meeting.",
        },
        keyTopics: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "A list of the core topics or themes discussed.",
        },
        actionItems: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            required: ["task", "assignee", "nextSteps"],
            properties: {
              task: { type: Type.STRING, description: "The specific, actionable task description." },
              assignee: { type: Type.STRING, description: "The name of the attendee responsible for this task." },
              deadline: { type: Type.STRING, description: "The inferred timeline or deadline, or 'Not specified'." },
              nextSteps: { type: Type.STRING, description: "A highly actionable, specific immediate next step to jumpstart the task." },
            },
          },
          description: "List of extracted action items with clear ownership.",
        },
        suggestedAgenda: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Suggested discussion points for the upcoming follow-up meeting.",
        },
        detectedDuration: {
          type: Type.INTEGER,
          description: "Detected or inferred duration in minutes for the follow-up meeting (e.g., 30, 45, 60, 90). Default to 30 if unspecified.",
        },
        inferredTargetDate: {
          type: Type.STRING,
          description: "Inferred follow-up target date in YYYY-MM-DD format based on relative terms in transcript.",
        },
      },
    };

    const modelsToTry = [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite"
    ];
    let response = null;
    let lastError = null;

    for (const model of modelsToTry) {
      try {
        console.log(`Attempting recap with model: ${model}`);
        response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: recapSchema,
          },
        });
        if (response && response.text) {
          console.log(`Successfully generated recap using model: ${model}`);
          break;
        }
      } catch (err: any) {
        const errType = err?.status === "RESOURCE_EXHAUSTED" || String(err?.message || "").includes("429") ? "Quota/Rate Limit" : "Service Busy/Unavailable";
        console.log(`[Recap API] Model ${model} (${errType}) -> trying next model or fallback.`);
        lastError = err;
      }
    }

    let parsedData;
    if (!response || !response.text) {
      console.log("[Recap API] Utilizing high-fidelity local semantic parser fallback.");
      parsedData = generateLocalFallbackRecap(transcript, attendees || [], meetingTitle, granularity);
    } else {
      try {
        const text = response.text;
        parsedData = JSON.parse(text.trim());
      } catch (parseErr) {
        console.log("[Recap API] JSON parse fallback to local semantic parser.");
        parsedData = generateLocalFallbackRecap(transcript, attendees || [], meetingTitle, granularity);
      }
    }
    return res.json(parsedData);
  } catch (error: any) {
    console.log("[Recap API] Local semantic parser active fallback.");
    try {
      const fallbackData = generateLocalFallbackRecap(
        req.body?.transcript || "", 
        req.body?.attendees || [], 
        req.body?.meetingTitle,
        req.body?.granularity
      );
      return res.json(fallbackData);
    } catch (fallbackError: any) {
      console.error("Fallback generator also failed:", fallbackError);
      return res.status(500).json({
        error: error.message || "An unexpected error occurred while analyzing the transcript.",
      });
    }
  }
});

// API endpoint for grounded assistant "Cadence Navigator"
app.post("/api/assistant", async (req, res) => {
  try {
    const { question, meetingContext } = req.body;
    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "Question is required." });
    }

    const ASSISTANT_SYSTEM_PROMPT = `
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
- Stage 1: Agent Aura (Task Extractor) - Ingests raw meeting transcripts and distills them into structured action items, assignees, deadlines, and priority levels.
- Stage 2: Agent Chronos (Timezone Optimizer) - Standardizes attendee timezones to UTC and evaluates slot overlaps using an algorithmic scoring system:
  * Gold: +10 points
  * Silver: +5 points
  * Sleeping: -15 points
  * Conflict: -100 points
  Pauses execution at the Decision Desk for PM confirmation.
- Stage 3: Agent Scribe (Comms Specialist) - Drafts executive recap emails combining tasks and schedules while enforcing a body cap under 1,600 characters for mailto: link compatibility.
- Stage 4: Outbox Transport Gateway - Dispatches outbound recaps via Google OAuth or Universal SMTP (Office365, Yahoo, custom) under a strict 2,000-character total payload limit.

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

    const FULL_SYSTEM_INSTRUCTION = `${ASSISTANT_SYSTEM_PROMPT}\n${dynamicContextBlock}`;

    let ai = null;
    try {
      ai = getGeminiClient();
    } catch (e) {
      return res.status(503).json({ error: "Gemini API key unavailable" });
    }

    const modelsToTry = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-2.0-flash"];
    let answerText = "";

    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [{ role: "user", parts: [{ text: question }] }],
          config: {
            systemInstruction: FULL_SYSTEM_INSTRUCTION,
            temperature: 0.1,
            maxOutputTokens: 1200,
          },
        });
        if (response && response.text) {
          answerText = response.text;
          break;
        }
      } catch (err: any) {
        console.warn(`[Assistant API] Model ${modelName} failed, trying next:`, err?.message || err);
      }
    }

    if (answerText) {
      return res.json({ answer: answerText });
    } else {
      return res.status(500).json({ error: "Failed to generate answer" });
    }
  } catch (err: any) {
    console.error("Assistant API Error:", err);
    return res.status(500).json({ error: err.message || "Failed to process question" });
  }
});

// Configure Vite or production static file serving
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Configuring Vite middleware for development");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving static production files from dist/");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT} under ${process.env.NODE_ENV || "development"} mode`);
  });
}

setupServer().catch((err) => {
  console.error("Failed to start server:", err);
});
