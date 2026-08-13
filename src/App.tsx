import { useState, useEffect, useMemo, useRef } from "react";
import {
  Sparkles,
  Users,
  Clock,
  Calendar,
  Mail,
  FileText,
  Plus,
  Trash2,
  Check,
  Download,
  Copy,
  Edit3,
  Globe,
  Layers,
  CheckCircle,
  HelpCircle,
  ArrowRight,
  ChevronRight,
  Info,
  AlertTriangle,
  CalendarCheck,
  History,
  FolderSync,
  ChevronDown,
  FolderPlus,
  Lock,
  ShieldCheck,
  Bot,
  Play,
  Send,
  Terminal,
  Settings,
  Cpu,
  RotateCcw,
  FileCheck,
  Cloud,
  FolderOpen,
  LogIn,
  LogOut,
  UserCheck,
  UserPlus,
  KeyRound,
  Eye,
  EyeOff,
  Server,
  Zap,
  CheckCircle2,
  CheckCheck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";
import { EmailConnectionManager } from "./components/EmailConnectionManager";
import { SynchronChatbot } from "./components/SynchronChatbot";
import { PrivacyPolicy } from "./components/PrivacyPolicy";
import { TermsOfService } from "./components/TermsOfService";
import { LegalConsentModal } from "./components/LegalConsentModal";
import { initAuth, googleSignIn, logout as googleSignOut } from "./lib/firebaseAuth";
import { queryFreeBusyForAttendees } from "./lib/googleCalendar";
import { validateRecipientEmail, validateRecipientsList, isPlaceholderDomain, isValidEmailSyntax } from "./services/gmailService";

import {
  Attendee,
  ProposedSlot,
  PRESET_TIMEZONES,
  calculateTimezoneOverlapSlots,
  generateIcsBlobUrl,
  buildMarkdownRecapEmail,
  extractAttendeesFromTranscript,
  inferAttendeeTimezones,
  getDeduplicatedRoster,
  DEFAULT_USER_PROFILES,
  MeetingEntry,
  MeetingThread,
  createDefaultThreads,
  SAMPLE_TRANSCRIPTS
} from "./utils";

export default function App() {
  // --- Input States ---
  const [meetingTitle, setMeetingTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [attendees, setAttendees] = useState<Attendee[]>(() => {
    const savedSession = localStorage.getItem("app_session_user");
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed?.email) {
          return [{
            id: "host_1",
            name: parsed.name || parsed.email.split("@")[0],
            email: parsed.email,
            timezone: parsed.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London",
            isHost: true
          }];
        }
      } catch (e) { }
    }
    const savedIdentity = localStorage.getItem("cadence_active_identity") || localStorage.getItem("m_synchron_active_identity");
    if (savedIdentity && savedIdentity !== "unassigned") {
      return [{
        id: "host_1",
        name: savedIdentity.split("@")[0],
        email: savedIdentity,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London",
        isHost: true
      }];
    }
    return [{
      id: "host_1",
      name: "Workspace Host",
      email: "your-email@domain.com",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London",
      isHost: true
    }];
  });
  const globalExtractedAttendeesRef = useRef<Attendee[]>([]);
  const [duration, setDuration] = useState<number>(30);
  const [referenceDate, setReferenceDate] = useState<string>(() => new Date().toISOString().split("T")[0]);

  // --- File Upload & Document States ---
  const [isFileDragging, setIsFileDragging] = useState(false);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [parsedFileName, setParsedFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [extractedSpeakers, setExtractedSpeakers] = useState<{ name: string; timezone: string }[]>([]);

  // --- Attendee Form States ---
  const [newAttendeeName, setNewAttendeeName] = useState("");
  const [newAttendeeEmail, setNewAttendeeEmail] = useState("");
  const [newAttendeeTimezone, setNewAttendeeTimezone] = useState("America/New_York");

  // --- Processing & Output States ---
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Distilled data from backend (Gemini)
  const [isExtracted, setIsExtracted] = useState<boolean>(false);
  const isExtractedRef = useRef<boolean>(false);
  const [isExecuted, setIsExecuted] = useState<boolean>(false);
  const isExecutedRef = useRef<boolean>(false);
  const [hasProcessed, setHasProcessed] = useState(false);
  const hasProcessedRef = useRef<boolean>(false);
  const [recapData, setRecapData] = useState<{
    suggestedTitle: string;
    summary: string;
    keyTopics: string[];
    actionItems: { task: string; assignee: string; deadline?: string; nextSteps?: string; completed?: boolean }[];
    suggestedAgenda: string[];
    isLocalFallback?: boolean;
  } | null>(null);

  // Timezone overlap slots state
  const [proposedSlots, setProposedSlots] = useState<ProposedSlot[]>([]);
  const setSlots = setProposedSlots;
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number>(0);

  // Markdown email edit state
  const [editedEmail, setEditedEmail] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [hasUserEditedSubject, setHasUserEditedSubject] = useState(false);
  const [emailMode, setEmailMode] = useState<"preview" | "edit">("preview");
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const [copiedPlainText, setCopiedPlainText] = useState(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState<"jira" | "markdown" | "csv" | null>(null);
  const [importFeedback, setImportFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isSaveRestoreMenuOpen, setIsSaveRestoreMenuOpen] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<"recap" | "overlap" | "calendar" | "email" | "threads" | "agents">("agents");

  // --- AI Agent States & Logs ---
  const [isAutopilotRunning, setIsAutopilotRunning] = useState(false);
  const isAgentAutopilotRunning = isAutopilotRunning;
  const setIsAgentAutopilotRunning = setIsAutopilotRunning;
  const [agentStep, setAgentStep] = useState<"idle" | "summarize" | "schedule" | "draft" | "complete">("idle");
  const [agentLogs, setAgentLogs] = useState<string[]>([]);

  // Agent 1: Summarizer Agent (Aura)
  const [auraTone, setAuraTone] = useState<"standard" | "detailed" | "high_priority">("standard");
  const [auraAutoSave, setAuraAutoSave] = useState(true);
  const [auraStatus, setAuraStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  const [auraLogs, setAuraLogs] = useState<string[]>([]);

  // Agent 2: Scheduler Agent (Chronos)
  const [chronosConstraint, setChronosConstraint] = useState<"core_only" | "core_shoulder" | "relaxed">("core_shoulder");
  const [chronosStatus, setChronosStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  const [chronosLogs, setChronosLogs] = useState<string[]>([]);
  const [chronosBestSlot, setChronosBestSlot] = useState<ProposedSlot | null>(null);

  // Agent 3: Email Drafter Agent (Scribe)
  const [scribeTone, setScribeTone] = useState<"professional" | "casual" | "technical">("professional");
  const [scribeStatus, setScribeStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  const [scribeLogs, setScribeLogs] = useState<string[]>([]);
  const [smtpStatus, setSmtpStatus] = useState<"not_sent" | "sending" | "sent" | "error">("not_sent");
  const [smtpLogs, setSmtpLogs] = useState<string[]>([]);
  const [gmailConnectionWarning, setGmailConnectionWarning] = useState<string | null>(null);
  const [preLoginWarning, setPreLoginWarning] = useState<string | null>(null);
  const [serverConnectionError, setServerConnectionError] = useState<string | null>(null);

  // Universal Email Connection State & Config
  const [emailConnectionType, setEmailConnectionType] = useState<"google" | "smtp">("google");
  const [smtpSaveSuccessMessage, setSmtpSaveSuccessMessage] = useState<string | null>(null);

  const [smtpConfig, setSmtpConfig] = useState<{
    providerName: string;
    senderName: string;
    senderEmail: string;
    smtpHost: string;
    smtpPort: number;
    appPassword: string;
  }>(() => {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("cadence_smtp_config") || localStorage.getItem("m_synchron_smtp_config");
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { /* ignore */ }
      }
    }
    return {
      providerName: "Outlook / Office365",
      senderName: "",
      senderEmail: "",
      smtpHost: "smtp.office365.com",
      smtpPort: 587,
      appPassword: ""
    };
  });

  const [smtpConfigSaved, setSmtpConfigSaved] = useState<boolean>(() => {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("cadence_smtp_config") || localStorage.getItem("m_synchron_smtp_config");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return !!(parsed && parsed.senderEmail && parsed.smtpHost);
        } catch (e) { return false; }
      }
    }
    return false;
  });

  const [recipients, setRecipients] = useState<string[]>([]);
  const [newRecipientInput, setNewRecipientInput] = useState("");

  // Synchronize recipients list with attendees when attendees list changes or on initialization
  useEffect(() => {
    if (!isExecuted || !attendees || attendees.length === 0) return;
    const attendeeEmails = attendees.map((a) => a.email).filter(Boolean);
    setRecipients(prev => {
      if (prev.length === 0) {
        return attendeeEmails;
      }
      const updated = [...prev];
      attendeeEmails.forEach(email => {
        if (!updated.includes(email)) {
          updated.push(email);
        }
      });
      return updated;
    });
  }, [isExecuted, attendees]);

  // Live validation of recipients list for placeholder domains and syntax
  const currentRecipientsValidation = useMemo(() => {
    const listToValidate = recipients.length > 0
      ? recipients
      : (attendees && attendees.length > 0 ? attendees.map((a) => a.email).filter(Boolean) : []);
    return validateRecipientsList(listToValidate);
  }, [recipients, attendees]);

  // Auto-claim default/placeholder threads for the active user
  useEffect(() => {
    if (!activeUserEmail || activeUserEmail === "unassigned") return;

    setThreads((prevThreads) =>
      prevThreads.map((thread) => {
        if (!thread.ownerEmail || thread.ownerEmail === "your-email@domain.com" || thread.ownerEmail === "unassigned") {
          return {
            ...thread,
            ownerEmail: activeUserEmail,
            allowedEmails: Array.from(new Set([...(thread.allowedEmails || []), activeUserEmail]))
          };
        }
        return thread;
      })
    );
  }, [activeUserEmail]);

  // Synchronize subject line with meeting title / recap data unless manually edited by user
  useEffect(() => {
    if (hasUserEditedSubject) return;
    if (meetingTitle.trim()) {
      setEmailSubject(`Recap: ${meetingTitle.trim()}`);
    } else if (recapData?.suggestedTitle) {
      setEmailSubject(`Recap: ${recapData.suggestedTitle}`);
    } else if (!emailSubject) {
      setEmailSubject("Project Horizon Sync: Summary & Action Items");
    }
  }, [meetingTitle, recapData, hasUserEditedSubject]);

  // --- Google Drive Integration States ---
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [isDriveLoading, setIsDriveLoading] = useState(false);
  const [driveFiles, setDriveFiles] = useState<{ id: string; name: string; mimeType: string; modifiedTime: string }[]>([]);
  const [driveSearchQuery, setDriveSearchQuery] = useState("");
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveAccessToken, setDriveAccessToken] = useState<string | null>(null);
  const [driveUser, setDriveUser] = useState<any>(null);
  const [isDriveParsing, setIsDriveParsing] = useState(false);

  const isGoogleConnected = !!(driveAccessToken || driveUser);
  const isSmtpConnected = smtpConfigSaved && !!(smtpConfig.senderEmail && smtpConfig.smtpHost);
  const isEmailConnected = isGoogleConnected || isSmtpConnected;

  // --- Legal & Privacy Consent State ---
  const [isLegalAccepted, setIsLegalAccepted] = useState<boolean>(() => {
    if (typeof localStorage !== "undefined") {
      const accepted = localStorage.getItem("cadence_legal_accepted") || localStorage.getItem("m_synchron_legal_accepted");
      return accepted === "true";
    }
    return false;
  });
  const [activeLegalModal, setActiveLegalModal] = useState<"privacy" | "terms" | null>(null);

  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [logoutCount, setLogoutCount] = useState(0);

  // Initialize Auth listener on app load
  useEffect(() => {
    const unsubscribe = initAuth(
      async (user, token) => {
        setDriveUser(user);
        setDriveAccessToken(token);
        if (user?.email) {
          const userEmail = user.email.toLowerCase();
          setCurrentUserEmail(userEmail);
        }
      },
      () => {
        setDriveUser(null);
        setDriveAccessToken(null);
        setCurrentUserEmail("");
      }
    );
    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  const handleGoogleAuthLogin = async () => {
    try {
      setIsGoogleSigningIn(true);
      setSetupError(null);
      const result = await googleSignIn();
      if (result?.user) {
        const userEmail = result.user.email?.toLowerCase() || "";
        const userName = result.user.displayName || userEmail.split("@")[0] || "User";
        const initials = userName.split(/\s+/).map(p => p[0]?.toUpperCase() || "").join("").slice(0, 2) || "U";
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";

        const newProfile = { name: userName, email: userEmail, avatar: initials, timezone: tz };

        setUserProfiles(prev => {
          const idx = prev.findIndex(p => p.email === userEmail);
          let updated = [...prev];
          if (idx >= 0) {
            updated[idx] = newProfile;
          } else {
            updated.push(newProfile);
          }
          localStorage.setItem("cadence_user_profiles", JSON.stringify(updated));
          return updated;
        });

        setCurrentUserEmail(userEmail);
        localStorage.setItem("cadence_active_identity", userEmail);

        setAttendees(prev => {
          const source = prev.length > 1 ? prev : (globalExtractedAttendeesRef.current.length > 1 ? globalExtractedAttendeesRef.current : prev);
          if (source.length === 0) {
            const initHost = [{ id: Date.now().toString(), name: userName, email: userEmail, timezone: tz, isHost: true }];
            globalExtractedAttendeesRef.current = initHost;
            return initHost;
          }
          const updated = source.map(a => (a.isHost || a.email.toLowerCase() === userEmail ? { ...a, timezone: tz } : a));
          globalExtractedAttendeesRef.current = updated;
          return updated;
        });

        setIsSetupModalOpen(false);
        setSaveSuccessMessage(`Welcome back, ${userName}! Signed in with Google Calendar timezone (${tz}).`);
        setTimeout(() => setSaveSuccessMessage(null), 3500);
      }
    } catch (err: any) {
      if (
        err?.code === "auth/popup-closed-by-user" ||
        err?.code === "auth/cancelled-popup-request" ||
        err?.message?.includes("popup-closed-by-user")
      ) {
        console.log("Google login cancelled by user.");
      } else {
        console.error("Google login failed:", err);
        setSetupError(err.message || "Failed to sign in with Google Account.");
      }
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await googleSignOut();
    } catch (e) {
      console.error("Logout error:", e);
    }

    // 1. Wipe all saved credentials, tokens, and thread cache from browser storage
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("app_session_user");
      localStorage.removeItem("cadence_smtp_config");
      localStorage.removeItem("m_synchron_smtp_config");
      localStorage.removeItem("google_oauth_token");
      localStorage.removeItem("google_oauth_email");
      localStorage.removeItem("cadence_threads_v1");
      localStorage.removeItem("m_synchron_threads_v1");
      localStorage.removeItem("cadence_threads");
      localStorage.removeItem("m_synchron_threads");
      localStorage.removeItem("cadence_user_profiles");
      localStorage.removeItem("m_synchron_user_profiles");
      localStorage.removeItem("cadence_user_passwords");
      localStorage.removeItem("m_synchron_user_passwords");
      localStorage.removeItem("gcal_access_token");
      localStorage.setItem("cadence_active_identity", "unassigned");
      localStorage.setItem("m_synchron_active_identity", "unassigned");
    }

    // 2. Explicitly purge transient React RAM state (Raw Transcripts, Tasks, Slots, Email Recaps, Logs)
    setTranscript("");
    setMeetingTitle("");
    setAttendees([]);
    setExtractedSpeakers([]);
    setParsedFileName(null);
    setFileError(null);
    setError(null);

    // Stage 1 (Aura) Purge
    setRecapData(null);
    setAuraStatus("idle");
    setAuraLogs([]);

    // Stage 2 (Chronos) Purge
    setProposedSlots([]);
    setSelectedSlotIndex(0);
    setChronosBestSlot(null);
    setChronosStatus("idle");
    setChronosLogs([]);

    // Stage 3 (Scribe) & Outbox Purge
    setEditedEmail("");
    setEmailSubject("");
    setRecipients([]);
    setScribeStatus("idle");
    setScribeLogs([]);
    setSmtpStatus("not_sent");
    setSmtpLogs([]);

    // Reset pipeline execution flags & refs
    setAgentLogs([]);
    isExtractedRef.current = false;
    setIsExtracted(false);
    isExecutedRef.current = false;
    setIsExecuted(false);
    hasProcessedRef.current = false;
    setHasProcessed(false);
    setAgentStep("idle");

    // Purge Thread state
    setThreads(createDefaultThreads("your-email@domain.com"));
    setActiveThreadId(null);

    // 3. Reset user session state
    setCurrentUserEmail("");
    setIsGuestMode(true);

    // Clear SMTP config state
    setSmtpConfig({
      providerName: "Outlook / Office365",
      senderName: "",
      senderEmail: "",
      smtpHost: "smtp.office365.com",
      smtpPort: 587,
      appPassword: ""
    });
    setSmtpConfigSaved(false);
    setSmtpSaveSuccessMessage(null);

    // Reset Google Drive / Connection badge state
    setDriveUser(null);
    setDriveAccessToken(null);
    setDriveFiles([]);

    // Clear warning messages
    setGmailConnectionWarning(null);
    setPreLoginWarning(null);

    // Trigger Chatbot and subcomponent re-mount reset
    setLogoutCount((prev) => prev + 1);

    setSaveSuccessMessage("Logged out successfully. All local credentials and React RAM workspace memory purged.");
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  // --- Profile Identity & Permission State ---
  const [userProfiles, setUserProfiles] = useState<{ name: string; email: string; avatar: string; timezone: string }[]>(() => {
    let rawProfiles: { name: string; email: string; avatar: string; timezone: string }[] = DEFAULT_USER_PROFILES;
    const saved = localStorage.getItem("cadence_user_profiles") || localStorage.getItem("m_synchron_user_profiles");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = [...parsed];
          for (const def of DEFAULT_USER_PROFILES) {
            if (!merged.some(p => p.email.toLowerCase() === def.email.toLowerCase() || p.name.toLowerCase() === def.name.toLowerCase())) {
              merged.push(def);
            }
          }
          rawProfiles = merged;
        }
      } catch (e) {
        console.error("Failed to parse saved user profiles:", e);
      }
    }
    const seen = new Set<string>();
    return rawProfiles.filter(p => {
      const emailLower = (p.email || "").toLowerCase().trim();
      if (!emailLower || seen.has(emailLower)) return false;
      seen.add(emailLower);
      return true;
    });
  });

  // Passwords store mapping email -> password
  const [userPasswords, setUserPasswords] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem("cadence_user_passwords") || localStorage.getItem("m_synchron_user_passwords");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved passwords:", e);
      }
    }
    return {};
  });

  const [authModalMode, setAuthModalMode] = useState<"login" | "register" | "edit">("login");
  const [setupPassword, setSetupPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [currentUserEmail, setCurrentUserEmail] = useState<string>(() => {
    const savedSession = localStorage.getItem("app_session_user");
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed?.email) return parsed.email;
      } catch (e) { }
    }
    const saved = localStorage.getItem("cadence_active_identity") || localStorage.getItem("m_synchron_active_identity");
    if (saved && saved !== "unassigned") return saved;
    return "";
  });

  const [isGuestMode, setIsGuestMode] = useState<boolean>(() => {
    const savedSession = localStorage.getItem("app_session_user");
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed?.email) return false;
      } catch (e) { }
    }
    const saved = localStorage.getItem("cadence_active_identity") || localStorage.getItem("m_synchron_active_identity");
    return !saved || saved === "unassigned";
  });

  // --- Clean User Email Resolver ---
  const activeUserEmail = useMemo(() => {
    if (currentUserEmail && currentUserEmail !== "unassigned") return currentUserEmail;
    if (typeof driveUser !== "undefined" && driveUser?.email) return driveUser.email;
    if (typeof auth !== "undefined" && auth?.currentUser?.email) return auth.currentUser.email;

    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("cadence_active_identity") || localStorage.getItem("m_synchron_active_identity");
      if (saved && saved !== "unassigned") return saved;
    }

    return null;
  }, [currentUserEmail, driveUser]);

  const isUserLoggedIn = Boolean(activeUserEmail);
  const isAuthenticated = isUserLoggedIn;
  const currentUser = activeUserEmail;

  // Restore Session on Mount from app_session_user
  useEffect(() => {
    const savedSession = localStorage.getItem("app_session_user");
    if (savedSession) {
      try {
        const userData = JSON.parse(savedSession);
        if (userData && userData.email) {
          setCurrentUserEmail(userData.email);
          setIsGuestMode(false);
          localStorage.setItem("cadence_active_identity", userData.email);
        }
      } catch (e) {
        console.error("Failed to restore app_session_user:", e);
      }
    }
  }, []);

  // Global Login Success Handler
  const handleLoginSuccess = (userData: { name: string; email: string; avatar?: string; timezone?: string }) => {
    const email = userData.email.trim().toLowerCase();
    setCurrentUserEmail(email);
    setIsGuestMode(false);
    localStorage.setItem("cadence_active_identity", email);
    localStorage.setItem("app_session_user", JSON.stringify({
      name: userData.name,
      email: email,
      avatar: userData.avatar || email.slice(0, 2).toUpperCase(),
      timezone: userData.timezone || "America/New_York"
    }));
  };

  // Automatically dismiss pre-login warning once user logs into the main app
  useEffect(() => {
    if (currentUserEmail && currentUserEmail !== "unassigned") {
      setPreLoginWarning(null);
    }
  }, [currentUserEmail]);

  // Automatically dismiss Email connection warning once Google or SMTP connection is active
  useEffect(() => {
    if (isEmailConnected) {
      setGmailConnectionWarning(null);
    }
  }, [isEmailConnected]);

  const currentHostProfile = userProfiles.find(p => p.email && p.email.toLowerCase() === currentUserEmail.toLowerCase());
  const currentUserObj = isAuthenticated ? {
    name: currentHostProfile?.name || (currentUserEmail ? currentUserEmail.split("@")[0] : "User"),
    email: currentUserEmail,
    timezone: currentHostProfile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London"
  } : null;

  const defaultHost: Attendee = currentUserObj ? {
    id: "host_1",
    name: currentUserObj.name,
    email: currentUserObj.email,
    timezone: currentUserObj.timezone || 'Europe/London',
    isHost: true
  } : {
    id: "host_1",
    name: driveUser?.displayName || (isSmtpConnected && smtpConfig.senderName ? smtpConfig.senderName : 'Workspace Host'),
    email: driveUser?.email || (isSmtpConnected && smtpConfig.senderEmail ? smtpConfig.senderEmail : 'your-email@domain.com'),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London',
    isHost: true
  };

  const currentHostName = defaultHost.name;
  const currentHostEmail = defaultHost.email;

  // Synchronize host attendee in state when authentication or connected outbox changes
  useEffect(() => {
    setAttendees(prev => {
      if (!prev || prev.length === 0) {
        return [defaultHost];
      }
      return prev.map(a => {
        if (a.isHost) {
          return {
            ...a,
            name: defaultHost.name,
            email: defaultHost.email,
            timezone: a.timezone || defaultHost.timezone
          };
        }
        return a;
      });
    });
  }, [
    currentUserEmail,
    isGuestMode,
    driveUser?.email,
    driveUser?.displayName,
    smtpConfigSaved,
    smtpConfig.senderEmail,
    smtpConfig.senderName
  ]);

  const [isSetupModalOpen, setIsSetupModalOpen] = useState<boolean>(() => {
    const savedIdentity = localStorage.getItem("cadence_active_identity") || localStorage.getItem("m_synchron_active_identity");
    return !savedIdentity; // Open modal if no identity has ever been selected/saved in LocalStorage
  });

  const isAuthModalOpen = isSetupModalOpen;
  const setIsAuthModalOpen = (open: boolean) => {
    setIsSetupModalOpen(open);
  };

  // Setup Modal Form Inputs
  const [setupName, setSetupName] = useState("");
  const [setupEmail, setSetupEmail] = useState("");
  const [setupTimezone, setSetupTimezone] = useState(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) return tz;
    } catch (e) { }
    return "America/New_York";
  });
  const [setupError, setSetupError] = useState<string | null>(null);

  // Profile & Authentication Management Handlers
  const handleSaveProfile = () => {
    const email = setupEmail.trim().toLowerCase();
    const password = setupPassword.trim();
    const timezone = setupTimezone;

    if (!email || !email.includes("@") || !email.includes(".")) {
      setSetupError("Please enter a valid email address.");
      return;
    }

    if (authModalMode === "login") {
      const existingProfile = userProfiles.find(p => p.email.toLowerCase() === email);
      const storedPassword = userPasswords[email];

      if (storedPassword) {
        if (!password) {
          setSetupError("Password is required for this account.");
          return;
        }
        if (password !== storedPassword) {
          setSetupError("Incorrect password for this user account.");
          return;
        }
      } else if (password) {
        // First time setting password for this email
        const updatedPasswords = { ...userPasswords, [email]: password };
        setUserPasswords(updatedPasswords);
        localStorage.setItem("cadence_user_passwords", JSON.stringify(updatedPasswords));
      }

      // Ensure profile exists or create default
      let name = setupName.trim();
      if (!name) {
        name = existingProfile ? existingProfile.name : email.split("@")[0];
      }
      const initials = name.split(/\s+/).map(part => part[0]?.toUpperCase() || "").join("").slice(0, 2) || "U";
      const newProfile = { name, email, avatar: initials, timezone };

      let updatedProfiles = [...userProfiles];
      const idx = updatedProfiles.findIndex(p => p.email === email);
      if (idx >= 0) {
        updatedProfiles[idx] = newProfile;
      } else {
        updatedProfiles.push(newProfile);
      }
      setUserProfiles(updatedProfiles);
      localStorage.setItem("cadence_user_profiles", JSON.stringify(updatedProfiles));

      setCurrentUserEmail(email);
      handleLoginSuccess(newProfile);

      if (attendees.length === 0) {
        setAttendees([{ id: Date.now().toString(), name, email, timezone, isHost: true }]);
      }

      setSetupError(null);
      setIsSetupModalOpen(false);
      setSaveSuccessMessage(`Successfully signed in as ${email}`);
      setTimeout(() => setSaveSuccessMessage(null), 3000);
      return;
    }

    if (authModalMode === "register") {
      const name = setupName.trim();
      if (!name) {
        setSetupError("Please enter your Full Name.");
        return;
      }
      if (!password || password.length < 4) {
        setSetupError("Please enter a password with at least 4 characters.");
        return;
      }

      const initials = name.split(/\s+/).map(part => part[0]?.toUpperCase() || "").join("").slice(0, 2) || "U";
      const newProfile = { name, email, avatar: initials, timezone };

      // Store password & profile
      const updatedPasswords = { ...userPasswords, [email]: password };
      setUserPasswords(updatedPasswords);
      localStorage.setItem("cadence_user_passwords", JSON.stringify(updatedPasswords));

      let updatedProfiles = [...userProfiles];
      const idx = updatedProfiles.findIndex(p => p.email === email);
      if (idx >= 0) {
        updatedProfiles[idx] = newProfile;
      } else {
        updatedProfiles.push(newProfile);
      }
      setUserProfiles(updatedProfiles);
      localStorage.setItem("cadence_user_profiles", JSON.stringify(updatedProfiles));

      setCurrentUserEmail(email);
      handleLoginSuccess(newProfile);

      if (attendees.length === 0) {
        setAttendees([{ id: Date.now().toString(), name, email, timezone, isHost: true }]);
      }

      setSetupError(null);
      setIsSetupModalOpen(false);
      setSaveSuccessMessage(`Account created & password saved! Signed in as ${email}`);
      setTimeout(() => setSaveSuccessMessage(null), 3000);
      return;
    }

    if (authModalMode === "edit") {
      const name = setupName.trim();
      if (!name) {
        setSetupError("Please enter your Full Name.");
        return;
      }
      const initials = name.split(/\s+/).map(part => part[0]?.toUpperCase() || "").join("").slice(0, 2) || "U";
      const newProfile = { name, email, avatar: initials, timezone };

      if (password) {
        const updatedPasswords = { ...userPasswords, [email]: password };
        setUserPasswords(updatedPasswords);
        localStorage.setItem("cadence_user_passwords", JSON.stringify(updatedPasswords));
      }

      let updatedProfiles = [...userProfiles];
      const idx = updatedProfiles.findIndex(p => p.email === email);
      if (idx >= 0) {
        updatedProfiles[idx] = newProfile;
      } else {
        updatedProfiles.push(newProfile);
      }
      setUserProfiles(updatedProfiles);
      localStorage.setItem("cadence_user_profiles", JSON.stringify(updatedProfiles));

      setCurrentUserEmail(email);
      handleLoginSuccess(newProfile);

      setSetupError(null);
      setIsSetupModalOpen(false);
      setSaveSuccessMessage(`Profile updated for ${email}`);
      setTimeout(() => setSaveSuccessMessage(null), 3000);
    }
  };

  const handleContinueAsGuest = () => {
    setCurrentUserEmail("");
    localStorage.setItem("cadence_active_identity", "unassigned");
    setIsGuestMode(true);
    setIsAuthModalOpen(false);
    setIsSetupModalOpen(false);
    setAgentLogs(prev => [
      ...prev,
      "[Session] 👤 Switched to Guest Mode."
    ]);
  };

  const handleSkipProfile = handleContinueAsGuest;

  const handleIdentityChange = (emailValue: string) => {
    if (emailValue === "__CREATE_NEW__") {
      setSetupName("");
      setSetupEmail("");
      setSetupPassword("");
      setAuthModalMode("register");
      setSetupError(null);
      setIsSetupModalOpen(true);
      return;
    }

    const hasPass = userPasswords[emailValue];
    if (hasPass) {
      // Prompt password check
      setSetupEmail(emailValue);
      setSetupName(userProfiles.find(p => p.email === emailValue)?.name || "");
      setSetupPassword("");
      setAuthModalMode("login");
      setSetupError(null);
      setIsSetupModalOpen(true);
      return;
    }

    setCurrentUserEmail(emailValue);
    if (emailValue) {
      localStorage.setItem("cadence_active_identity", emailValue);
      const prof = userProfiles.find(p => p.email === emailValue);
      if (prof && attendees.length === 0) {
        setAttendees([
          {
            id: Date.now().toString(),
            name: prof.name,
            email: prof.email,
            timezone: prof.timezone || "America/New_York",
            isHost: true
          }
        ]);
      }
    } else {
      localStorage.setItem("cadence_active_identity", "unassigned");
    }
  };

  // Reset Session & Workspace Handler
  const handleResetWorkspace = () => {
    // 1. Preserved States (DO NOT TOUCH):
    // - Keep isAuthenticated TRUE
    // - Keep user profile data intact
    // - Keep connected email credentials (smtpConfig, isGoogleConnected)
    // - Keep isAuthModalOpen set to FALSE
    setIsSetupModalOpen(false);

    // 2. Reset Workflow States (CLEAR ONLY):
    // a. Reset transcript input: setMeetingNotes('') / setTranscript('')
    setTranscript("");
    setMeetingTitle("");

    // b. Reset Stage 1 (Aura): setAuraAnalysis(null) / setRecapData(null)
    setRecapData(null);
    setAuraStatus("idle");
    setAuraLogs([]);

    // c. Reset Stage 2 (Chronos): setSelectedSlot(null), setOverlapSlots([])
    setChronosBestSlot(null);
    setSelectedSlotIndex(0);
    setProposedSlots([]);
    setChronosStatus("idle");
    setChronosLogs([]);

    // d. Reset Stage 3 (Scribe): setEmailDraft(''), setSubject('')
    setEditedEmail("");
    setEmailSubject("");
    setRecipients([]);
    setScribeStatus("idle");
    setScribeLogs([]);
    setSmtpStatus("not_sent");
    setSmtpLogs([]);

    // e. Reset Orchestrator Activity Ledger: setActivityLogs([]) / setAgentLogs([])
    setAgentLogs([]);
    setIsAutopilotRunning(false);
    setAgentStep("idle");

    // Reset pipeline execution status flags
    isExtractedRef.current = false;
    setIsExtracted(false);
    isExecutedRef.current = false;
    setIsExecuted(false);
    hasProcessedRef.current = false;
    setHasProcessed(false);

    // Reset Attendees to Host Default
    const hostUser: Attendee = defaultHost;
    setAttendees([hostUser]);
    globalExtractedAttendeesRef.current = [hostUser];

    setExtractedSpeakers([]);
    setParsedFileName(null);
    setError(null);

    // Toast feedback notification
    setSaveSuccessMessage("Workspace & Agent Pipeline reset.");
    setTimeout(() => setSaveSuccessMessage(null), 3500);
  };

  const handleFinishAndClear = () => {
    handleResetWorkspace();
    setActiveTab("agents");
    setSaveSuccessMessage("Session completed and workspace cleared!");
    setTimeout(() => setSaveSuccessMessage(null), 3500);
  };

  const handleResetWorkspaceSession = handleResetWorkspace;

  // --- Recurring Meeting Threads State ---
  const [threads, setThreads] = useState<MeetingThread[]>(() => {
    const initialUser = localStorage.getItem("cadence_active_identity") || localStorage.getItem("m_synchron_active_identity") || "your-email@domain.com";
    const defaultList = createDefaultThreads(initialUser === "unassigned" ? "your-email@domain.com" : initialUser);

    const saved = localStorage.getItem("cadence_threads") || localStorage.getItem("m_synchron_threads");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasHorizon = parsed.some((t: any) => t.id === "thread-horizon" || t.title?.toLowerCase().includes("horizon"));
          if (!hasHorizon) {
            return [defaultList[0], ...parsed];
          }
          return parsed;
        }
      } catch (e) {
        console.error("Failed to parse saved threads:", e);
      }
    }
    return defaultList;
  });

  // Ensure Project Horizon thread is always present and accessible to active user or guest
  useEffect(() => {
    const norm = (currentUserEmail || "your-email@domain.com").trim().toLowerCase();
    setThreads(prev => {
      let updated = [...prev];
      const hasHorizon = updated.some(t => t.id === "thread-horizon" || t.title.toLowerCase().includes("horizon"));

      if (!hasHorizon) {
        const defaultList = createDefaultThreads(norm);
        const horizon = defaultList.find(t => t.id === "thread-horizon") || defaultList[0];
        updated = [horizon, ...updated];
      }

      let changed = false;
      updated = updated.map(t => {
        if (t.id === "thread-horizon" || t.title.toLowerCase().includes("horizon")) {
          const isOwner = t.ownerEmail?.toLowerCase() === norm;
          const isAllowed = Array.isArray(t.allowedEmails) && t.allowedEmails.some(e => e.toLowerCase() === norm);
          if (!isOwner && !isAllowed) {
            changed = true;
            return {
              ...t,
              allowedEmails: Array.from(new Set([...(t.allowedEmails || []), norm, "your-email@domain.com"]))
            };
          }
        }
        return t;
      });

      if (!hasHorizon || changed) {
        localStorage.setItem("cadence_threads", JSON.stringify(updated));
        return updated;
      }
      return prev;
    });
  }, [currentUserEmail]);

  // Filter threads strictly by membership / ownership (No threads visible when logged out)
  const visibleThreads = useMemo(() => {
    if (!currentUserEmail) {
      return [];
    }
    const norm = currentUserEmail.trim().toLowerCase();
    return threads.filter(t => {
      const isOwner = Boolean(t.ownerEmail && t.ownerEmail.toLowerCase() === norm);
      const isAllowed = Array.isArray(t.allowedEmails) && t.allowedEmails.some(e => e.toLowerCase() === norm);
      return isOwner || isAllowed;
    });
  }, [threads, currentUserEmail]);

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  // Handle activeThread selection security fallback when identity or visibility list changes
  useEffect(() => {
    if (!currentUserEmail || visibleThreads.length === 0) {
      setActiveThreadId(null);
      return;
    }
    if (activeThreadId) {
      const isVisible = visibleThreads.some(t => t.id === activeThreadId);
      if (!isVisible) {
        setActiveThreadId(null);
      }
    }
  }, [currentUserEmail, visibleThreads, activeThreadId]);

  const [saveTargetThreadId, setSaveTargetThreadId] = useState("");
  const [newThreadTitle, setNewThreadTitle] = useState("");
  const [threadSubTab, setThreadSubTab] = useState<"timeline" | "tasks">("timeline");
  const [expandedEntryIds, setExpandedEntryIds] = useState<Record<string, boolean>>({});
  const [createThreadNameInput, setCreateThreadNameInput] = useState("");
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Persist threads to localStorage
  useEffect(() => {
    localStorage.setItem("cadence_threads", JSON.stringify(threads));
  }, [threads]);

  // Loading indicator helper cycles through realistic milestones
  useEffect(() => {
    if (!isLoading) return;

    const steps = [
      "Analyzing transcript structure...",
      "Identifying speaker context and intent...",
      "Extracting critical decision points...",
      "Drafting executive summary...",
      "Isolating action items and assignees...",
      "Finalizing follow-up meeting agenda..."
    ];

    let currentIdx = 0;
    setLoadingStep(steps[0]);

    const interval = setInterval(() => {
      currentIdx = (currentIdx + 1) % steps.length;
      setLoadingStep(steps[currentIdx]);
    }, 2500);

    return () => clearInterval(interval);
  }, [isLoading]);

  // Convert browser File to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const resultStr = reader.result as string;
        // Strip metadata prefix
        const base64 = resultStr.split(",")[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Read and parse dropped or uploaded TXT / DOCX files
  const handleFileDropOrSelect = async (file: File) => {
    if (!file) return;

    setFileError(null);
    setParsedFileName(null);
    setExtractedSpeakers([]);

    const extension = file.name.split(".").pop()?.toLowerCase();

    if (extension === "txt") {
      setIsParsingFile(true);
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = (e.target?.result as string) || "";
        setTranscript(text);
        setParsedFileName(file.name);
        setIsParsingFile(false);

        // Auto-extract potential attendee/speaker list
        const extracted = await extractAttendeesFromTranscript(text, userProfiles);
        const news = extracted.filter(
          (extractedItem) => !attendees.some(
            (existingItem) => existingItem.name.toLowerCase() === extractedItem.name.toLowerCase()
          )
        );
        setExtractedSpeakers(news);
      };
      reader.onerror = () => {
        setFileError("Failed to read the text file.");
        setIsParsingFile(false);
      };
      reader.readAsText(file);
    } else if (extension === "docx" || extension === "doc") {
      setIsParsingFile(true);
      try {
        const base64 = await fileToBase64(file);
        const response = await fetch("/api/parse-docx", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileData: base64,
            fileName: file.name
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(errText || "Server error while extracting Word file.");
        }

        const data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }

        setTranscript(data.text || "");
        setParsedFileName(file.name);

        // Auto-extract potential attendee/speaker list
        const extracted = await extractAttendeesFromTranscript(data.text || "", userProfiles);
        const news = extracted.filter(
          (extractedItem) => !attendees.some(
            (existingItem) => existingItem.name.toLowerCase() === extractedItem.name.toLowerCase()
          )
        );
        setExtractedSpeakers(news);
      } catch (err: any) {
        console.error("Docx parsing error:", err);
        setFileError(err.message || "Could not parse this Word file. Please check file formatting.");
      } finally {
        setIsParsingFile(false);
      }
    } else {
      setFileError("Unsupported format. Please upload a .docx, .doc or .txt file.");
    }
  };

  const handleOpenDriveImport = async () => {
    setIsDriveModalOpen(true);
    let currentToken = driveAccessToken;
    if (!currentToken) {
      const isAppLoggedIn = !!currentUserEmail && currentUserEmail !== "unassigned";
      if (!isAppLoggedIn) {
        const preLoginMsg = "🔒 Authentication Required: Please log into your app account first before linking your Google Email / Drive integration.";
        setPreLoginWarning(preLoginMsg);
        setError(preLoginMsg);
        setAgentLogs(prev => [
          ...prev,
          "[Google Integration] ⚠️ AUTHENTICATION REQUIRED: Please log into your app account first before linking your Google Email / Drive integration."
        ]);
        setIsSetupModalOpen(true);
        setAuthModalMode("login");
        return;
      }
      try {
        const result = await googleSignIn();
        if (result) {
          setDriveUser(result.user);
          setDriveAccessToken(result.accessToken);
          currentToken = result.accessToken;
        } else {
          return;
        }
      } catch (err: any) {
        if (
          err?.code === "auth/popup-closed-by-user" ||
          err?.code === "auth/cancelled-popup-request" ||
          err?.message?.includes("popup-closed-by-user")
        ) {
          return;
        }
        console.error("Sign in failed:", err);
        setDriveError("Could not log in to Google Account. Please try again.");
        return;
      }
    }
    if (currentToken) {
      fetchDriveFiles(currentToken);
    }
  };

  const fetchDriveFiles = async (token: string) => {
    setIsDriveLoading(true);
    setDriveError(null);
    try {
      const q = encodeURIComponent(
        "mimeType = 'application/vnd.google-apps.document' or " +
        "mimeType = 'text/plain' or " +
        "mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'"
      );
      const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,modifiedTime)&orderBy=modifiedTime desc`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error(`Failed to list files from Google Drive: ${res.statusText}`);
      }
      const data = await res.json();
      setDriveFiles(data.files || []);
    } catch (err: any) {
      console.error("Error fetching Drive files:", err);
      setDriveError(err.message || "Could not retrieve files from Google Drive.");
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleImportDriveFile = async (file: { id: string; name: string; mimeType: string }) => {
    if (!driveAccessToken) return;
    setIsDriveParsing(true);
    setDriveError(null);
    try {
      if (file.mimeType === "application/vnd.google-apps.document") {
        // Export Google Doc as plain text
        const url = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain`;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${driveAccessToken}` }
        });
        if (!response.ok) {
          throw new Error("Could not download Google Doc contents.");
        }
        const text = await response.text();
        setTranscript(text);
        setParsedFileName(file.name);
        setIsDriveModalOpen(false);

        // Auto-extract speakers from Google Doc
        const extracted = await extractAttendeesFromTranscript(text, userProfiles);
        const news = extracted.filter(
          (extractedItem) => !attendees.some(
            (existingItem) => existingItem.name.toLowerCase() === extractedItem.name.toLowerCase()
          )
        );
        setExtractedSpeakers(news);
      } else if (file.mimeType === "text/plain") {
        // Fetch raw text
        const url = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${driveAccessToken}` }
        });
        if (!response.ok) {
          throw new Error("Could not download text file contents.");
        }
        const text = await response.text();
        setTranscript(text);
        setParsedFileName(file.name);
        setIsDriveModalOpen(false);

        // Auto-extract speakers from text file
        const extractedTxt = await extractAttendeesFromTranscript(text, userProfiles);
        const newsTxt = extractedTxt.filter(
          (extractedItem) => !attendees.some(
            (existingItem) => existingItem.name.toLowerCase() === extractedItem.name.toLowerCase()
          )
        );
        setExtractedSpeakers(newsTxt);
      } else if (file.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        // Fetch .docx as binary, convert to base64, and parse via our backend
        const url = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${driveAccessToken}` }
        });
        if (!response.ok) {
          throw new Error("Could not download Word file contents.");
        }
        const blob = await response.blob();

        // Convert blob to base64
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          try {
            const base64data = (reader.result as string).split(",")[1];
            const parseResponse = await fetch("/api/parse-docx", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fileData: base64data,
                fileName: file.name
              })
            });
            if (!parseResponse.ok) {
              const errText = await parseResponse.text();
              throw new Error(errText || "Server error while extracting Word file.");
            }
            const data = await parseResponse.json();
            if (data.error) {
              throw new Error(data.error);
            }
            setTranscript(data.text || "");
            setParsedFileName(file.name);
            setIsDriveModalOpen(false);

            // Auto-extract potential attendee/speaker list
            const extracted = await extractAttendeesFromTranscript(data.text || "", userProfiles);
            const news = extracted.filter(
              (extractedItem) => !attendees.some(
                (existingItem) => existingItem.name.toLowerCase() === extractedItem.name.toLowerCase()
              )
            );
            setExtractedSpeakers(news);
          } catch (err: any) {
            console.error("Error parsing downloaded docx file:", err);
            setDriveError(err.message || "Failed to parse the Word document contents.");
          } finally {
            setIsDriveParsing(false);
          }
        };
        return; // Wait for async file reader to finish
      } else {
        throw new Error("Unsupported format selected.");
      }
    } catch (err: any) {
      console.error("Error importing Drive file:", err);
      setDriveError(err.message || "Could not load the file contents.");
    } finally {
      setIsDriveParsing(false);
    }
  };

  // Add a new attendee to the list
  const handleAddAttendee = () => {
    if (!newAttendeeName.trim()) return;
    const newAttendee: Attendee = {
      id: String(Date.now()),
      name: newAttendeeName.trim(),
      email: newAttendeeEmail.trim(),
      timezone: newAttendeeTimezone,
      isHost: attendees.length === 0 // Mark as host if they are the first
    };
    setAttendees([...attendees, newAttendee]);
    setNewAttendeeName("");
    setNewAttendeeEmail("");
  };

  // Remove attendee
  const handleRemoveAttendee = (id: string) => {
    const updated = attendees.filter((a) => a.id !== id);
    // If we removed the host, designate the first attendee remaining as host
    if (updated.length > 0 && !updated.some((a) => a.isHost)) {
      updated[0].isHost = true;
    }
    setAttendees(updated);
  };

  // Set host
  const handleSetHost = (id: string) => {
    setAttendees(
      attendees.map((a) => ({
        ...a,
        isHost: a.id === id
      }))
    );
  };

  // Mandatory Pipeline Functions with Guard Clauses
  const queryCalendarFreeBusy = async (activeAttendees: Attendee[], targetDateStr?: string) => {
    if (!hasProcessed && !hasProcessedRef.current && !isExtracted && !isExtractedRef.current && !isExecuted && !isExecutedRef.current) {
      console.log('Pipeline blocked: Waiting for manual click.');
      return [];
    }
    return await queryFreeBusyForAttendees(driveAccessToken, activeAttendees, targetDateStr ? new Date(targetDateStr) : undefined);
  };

  const runChronosPipeline = async (activeAttendees: Attendee[], targetDateStr?: string, isExplicitUserTrigger: boolean = true) => {
    if (!hasProcessed && !hasProcessedRef.current && !isExtracted && !isExtractedRef.current && !isExecuted && !isExecutedRef.current) {
      console.log('Pipeline blocked: Waiting for manual click.');
      return [];
    }
    const cleanAttendees = getDeduplicatedRoster(
      activeAttendees,
      defaultHost.name,
      defaultHost.email
    );
    console.log('[Chronos Pipeline Triggered]');
    console.trace("CHRONOS CALLER STACK TRACE");
    const todayStr = new Date().toISOString().split("T")[0];
    const currentTargetDates = (!targetDateStr || targetDateStr < todayStr) ? todayStr : targetDateStr;

    let freeBusyData: any = [];
    try {
      if (driveAccessToken) {
        console.log('[Chronos] Logged in user detected. Querying live Google Calendar Free/Busy API...');
        freeBusyData = await queryCalendarFreeBusy(cleanAttendees, currentTargetDates);
      } else {
        console.log('[Chronos] Guest mode detected (no access token). Running Chronos using local/mock calendar availability.');
      }
    } catch (err) {
      console.warn('[Chronos] FreeBusy API failed, falling back to local availability checks:', err);
    }

    const slots = calculateTimezoneOverlapSlots(cleanAttendees, new Date(currentTargetDates), duration, freeBusyData, isExplicitUserTrigger);
    setProposedSlots(slots);
    if (slots.length > 0) {
      setChronosBestSlot(slots[0]);
    }
    return slots;
  };

  const runAuraAgent = async (transcriptText: string, activeAttendees?: Attendee[], title?: string, tone?: string) => {
    if (!hasProcessed && !hasProcessedRef.current && !isExtracted && !isExtractedRef.current && !isExecuted && !isExecutedRef.current) {
      console.log('Pipeline blocked: Waiting for manual click.');
      return null;
    }

    const hostUser: Attendee = defaultHost;

    let safeAttendees = activeAttendees;
    if (!safeAttendees || safeAttendees.length === 0) {
      const extracted = await extractAttendeesFromTranscript(transcriptText, userProfiles);
      const mergedMap = new Map<string, Attendee>();
      mergedMap.set((hostUser.email || hostUser.name).toLowerCase().trim(), hostUser);
      if (attendees.length > 0) {
        attendees.forEach(a => {
          const key = (a.email || a.name).toLowerCase().trim();
          mergedMap.set(key, a);
        });
      }
      extracted.forEach(a => {
        const key = (a.email || a.name).toLowerCase().trim();
        if (mergedMap.has(key)) {
          const existing = mergedMap.get(key)!;
          mergedMap.set(key, {
            ...existing,
            email: existing.email || a.email,
            timezone: a.timezone || existing.timezone
          });
        } else {
          mergedMap.set(key, {
            id: String(Date.now() + Math.random()),
            name: a.name,
            email: a.email || `${a.name.toLowerCase().replace(/\s+/g, ".")}@company.com`,
            timezone: a.timezone || "America/New_York",
            isHost: false
          });
        }
      });
      safeAttendees = getDeduplicatedRoster(Array.from(mergedMap.values()), hostUser.name, hostUser.email);
    }

    const currentTitle = title || meetingTitle.trim() || "Weekly Engineering Sync";
    const currentTone = tone || auraTone || "standard";

    setAuraStatus("running");
    setAuraLogs([
      `[Aura] 🤖 Agent initialized: Meeting Distillation & Action Extractor`,
      `[Aura] Prompt tone: '${currentTone.toUpperCase()}'`,
      `[Aura] Analysing raw conversational transcription (${transcriptText.length} characters)...`,
      `[Aura] Requesting structured cognitive JSON mapping from Gemini 3.5 Flash...`
    ]);

    const response = await fetch("/api/recap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript: transcriptText,
        attendees: safeAttendees,
        meetingTitle: currentTitle,
        granularity: currentTone
      })
    });

    if (!response.ok) throw new Error("Aura Agent recapping query failed. Check your network or API keys.");
    const data = await response.json();

    const enrichedActionItems = data.actionItems.map((item: any) => ({
      ...item,
      completed: false
    }));

    const finalRecap = {
      ...data,
      actionItems: enrichedActionItems,
      participants: safeAttendees,
      attendees: safeAttendees
    };
    setRecapData(finalRecap);

    const todayStr = new Date().toISOString().split("T")[0];
    const currentTargetDates = (!referenceDate || referenceDate < todayStr) ? todayStr : referenceDate;
    const extractedDuration = typeof data.detectedDuration === "number" ? data.detectedDuration : 30;
    const rawExtractedDate = (data.inferredTargetDate && /^\d{4}-\d{2}-\d{2}$/.test(data.inferredTargetDate))
      ? data.inferredTargetDate
      : currentTargetDates;
    const extractedDate = rawExtractedDate < todayStr ? todayStr : rawExtractedDate;

    setDuration(extractedDuration);
    setReferenceDate(extractedDate);
    setAttendees(safeAttendees);
    globalExtractedAttendeesRef.current = safeAttendees;

    setAuraStatus("completed");
    setAuraLogs(prev => [
      ...prev,
      `[Aura] ✅ Distillation finished!`,
      `[Aura] Executive Summary generated (${data.summary.length} characters).`,
      `[Aura] Identified ${data.keyTopics.length} key discussion pillars.`,
      `[Aura] Mapped ${data.actionItems.length} tasks to assignees.`
    ]);

    return finalRecap;
  };

  const runScribeAgent = async (title: string, recap: any, slot: ProposedSlot | null, tone: string, atts: Attendee[], dur: number) => {
    if (!hasProcessed && !hasProcessedRef.current && !isExtracted && !isExtractedRef.current && !isExecuted && !isExecutedRef.current) {
      console.log('Pipeline blocked: Waiting for manual click.');
      return;
    }
    setScribeStatus("running");
    setScribeLogs([
      `[Scribe] 🤖 Agent initialized: Outbound SMTP Communication Drafter`,
      `[Scribe] Composition tone preference: '${tone.toUpperCase()}'`,
      `[Scribe] Sourcing Aura recap summary and selected Chronos schedule slot...`,
      `[Scribe] Selected Slot: ${slot ? slot.utcDate.toLocaleDateString() + " at " + slot.utcDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "None"}`,
      `[Scribe] Translating parameters to highly readable, structural markdown...`
    ]);

    await new Promise(r => setTimeout(r, 800));

    const emailBody = buildMarkdownRecapEmail(
      title.trim() || recap.suggestedTitle || "Weekly Engineering Sync",
      recap.summary,
      recap.keyTopics,
      recap.actionItems,
      recap.suggestedAgenda,
      slot,
      dur,
      atts
    );

    let tailoredEmail = emailBody;
    if (tone === "casual") {
      tailoredEmail = emailBody
        .replace("Dear Team,", "Hey everyone! 👋")
        .replace("Please find the distilled recap, action items, and follow-up meeting proposals from our recent sync below.", "Here is a quick, relaxed recap of what we talked about and what's next on our plates.")
        .replace("Executive Summary", "What Went Down")
        .replace("Action Items & Deliverables", "Tasks & To-Dos ✅")
        .replace("Follow-up Sync Proposal", "Our Next Follow-up Chat 📅");
    } else if (tone === "technical") {
      tailoredEmail = `### 💻 TECHNICAL RECAPPING & SYSTEMS COMPATIBILITY REPORT: ${(title || recap.suggestedTitle || "Weekly Sync").toUpperCase()}\n\n` + emailBody;
    }

    setEditedEmail(tailoredEmail);
    setScribeStatus("completed");
    setScribeLogs(prev => [
      ...prev,
      `[Scribe] Custom markdown body prepared (${tailoredEmail.length} characters).`,
      `[Scribe] Recipient lists parsed: ${atts.map(a => a.email).join(", ")}`,
      `[Scribe] ✅ Draft compiled and loaded into the Review Workspace.`
    ]);
  };

  // Submit transcript for analysis & calculation (Stage 1: Extract Intelligence)
  const handleProcessTranscript = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!transcript.trim()) {
      setError("Please paste a meeting transcript or select a sample preset first.");
      return;
    }

    // Purge prior agent execution states & logs on re-extraction
    setAuraStatus("idle");
    setChronosStatus("idle");
    setScribeStatus("idle");
    setSmtpStatus("not_sent");
    setAgentStep("idle");
    setIsAutopilotRunning(false);

    setAgentLogs([]);
    setAuraLogs([]);
    setChronosLogs([]);
    setScribeLogs([]);
    setSmtpLogs([]);

    setRecapData(null);
    setProposedSlots([]);
    setChronosBestSlot(null);
    setSelectedSlotIndex(0);
    setEditedEmail("");
    setEmailSubject("");
    setRecipients([]);
    isExecutedRef.current = false;
    setIsExecuted(false);

    hasProcessedRef.current = true;
    setHasProcessed(true);
    setIsLoading(true);
    setError(null);

    try {
      const transcriptText = transcript;
      const todayStr = new Date().toISOString().split("T")[0];
      const currentTargetDates = (!referenceDate || referenceDate < todayStr) ? todayStr : referenceDate;

      const hostUser: Attendee = defaultHost;

      const extracted = await extractAttendeesFromTranscript(transcriptText, userProfiles);

      // Merge existing state attendees with extracted transcript attendees without duplicate entries
      const mergedMap = new Map<string, Attendee>();
      mergedMap.set((hostUser.email || hostUser.name).toLowerCase().trim(), hostUser);

      if (attendees.length > 0) {
        attendees.forEach(a => {
          const key = (a.email || a.name).toLowerCase().trim();
          mergedMap.set(key, a);
        });
      }

      extracted.forEach(a => {
        const key = (a.email || a.name).toLowerCase().trim();
        if (mergedMap.has(key)) {
          const existing = mergedMap.get(key)!;
          mergedMap.set(key, {
            ...existing,
            email: existing.email || a.email,
            timezone: a.timezone || existing.timezone
          });
        } else {
          mergedMap.set(key, {
            id: String(Date.now() + Math.random()),
            name: a.name,
            email: a.email || `${a.name.toLowerCase().replace(/\s+/g, ".")}@company.com`,
            timezone: a.timezone || "America/New_York",
            isHost: false
          });
        }
      });

      const safeAttendees = getDeduplicatedRoster(Array.from(mergedMap.values()), hostUser.name, hostUser.email);
      globalExtractedAttendeesRef.current = safeAttendees;
      setAttendees(safeAttendees);

      // Stage 1 ONLY runs Aura Agent for summary and action items extraction
      const data = await runAuraAgent(transcriptText, safeAttendees, meetingTitle.trim() || "Untitled Sync", auraTone);
      if (!data) throw new Error("Aura Agent failed to generate recap data.");

      // Extract AI-detected duration and inferred target date
      const extractedDuration = typeof data.detectedDuration === "number" ? data.detectedDuration : 30;
      const rawExtractedDate = (data.inferredTargetDate && /^\d{4}-\d{2}-\d{2}$/.test(data.inferredTargetDate))
        ? data.inferredTargetDate
        : currentTargetDates;
      const extractedDate = rawExtractedDate < todayStr ? todayStr : rawExtractedDate;

      setDuration(extractedDuration);
      setReferenceDate(extractedDate);

      // Set isExtracted to true to reveal the workspace and AI Autopilot section
      isExtractedRef.current = true;
      setIsExtracted(true);
      setActiveTab("recap");
      setAgentLogs(prev => [...prev, "[Aura Extractor] Transcript intelligence extracted. AI Autopilot ready for deployment."]);

      return;
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred while communicating with the Gemini server.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExtractIntelligence = handleProcessTranscript;

  // Handle checking off an action item
  const toggleActionItem = (index: number) => {
    if (!recapData) return;
    const updatedItems = [...recapData.actionItems];
    updatedItems[index].completed = !updatedItems[index].completed;
    setRecapData({
      ...recapData,
      actionItems: updatedItems
    });
  };

  // Handle saving current recap to a selected or new thread
  const handleSaveToThread = () => {
    if (!recapData) return;

    let targetThreadId = saveTargetThreadId;
    let updatedThreads = [...threads];

    // 1. Handle creating a new thread if needed
    if (saveTargetThreadId === "new") {
      const trimmedTitle = newThreadTitle.trim();
      if (!trimmedTitle) {
        alert("Please specify a title for the new recurring thread.");
        return;
      }
      const newThread: MeetingThread = {
        id: "thread-" + Date.now(),
        title: trimmedTitle,
        createdAt: new Date().toISOString().split("T")[0],
        entries: [],
        ownerEmail: currentUserEmail,
        allowedEmails: []
      };
      updatedThreads.push(newThread);
      targetThreadId = newThread.id;
      setNewThreadTitle("");
    }

    if (!targetThreadId) {
      alert("Please select a valid thread to save to.");
      return;
    }

    // 2. Find the thread and add the new entry
    const threadIndex = updatedThreads.findIndex(t => t.id === targetThreadId);
    if (threadIndex === -1) return;

    const newEntry: MeetingEntry = {
      id: "entry-" + Date.now(),
      dateStr: referenceDate,
      meetingTitle: meetingTitle.trim() || recapData.suggestedTitle,
      recapTitle: recapData.suggestedTitle,
      summary: recapData.summary,
      keyTopics: recapData.keyTopics,
      actionItems: recapData.actionItems.map(item => ({ ...item })),
      suggestedAgenda: recapData.suggestedAgenda,
      selectedSlot: selectedSlot ? {
        dateStr: selectedSlot.utcDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
        timeStr: selectedSlot.utcDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) + " UTC"
      } : null
    };

    updatedThreads[threadIndex] = {
      ...updatedThreads[threadIndex],
      entries: [newEntry, ...updatedThreads[threadIndex].entries] // Add to start of list
    };

    setThreads(updatedThreads);
    setActiveThreadId(targetThreadId);
    setSaveTargetThreadId("");

    // Clear save success message after 4 seconds
    setSaveSuccessMessage(`Successfully saved to "${updatedThreads[threadIndex].title}"!`);
    setTimeout(() => {
      setSaveSuccessMessage(null);
    }, 4000);
  };

  // Toggle checklist inside active thread's entries
  const toggleThreadEntryActionItem = (threadId: string, entryId: string, itemIdx: number) => {
    setThreads(prev => prev.map(t => {
      if (t.id !== threadId) return t;
      return {
        ...t,
        entries: t.entries.map(e => {
          if (e.id !== entryId) return e;
          const updatedItems = [...e.actionItems];
          updatedItems[itemIdx] = {
            ...updatedItems[itemIdx],
            completed: !updatedItems[itemIdx].completed
          };
          return {
            ...e,
            actionItems: updatedItems
          };
        })
      };
    }));
  };

  // Delete a specific meeting entry in a thread
  const handleDeleteEntry = (threadId: string, entryId: string) => {
    if (!window.confirm("Are you sure you want to delete this meeting entry? This cannot be undone.")) return;
    setThreads(prev => prev.map(t => {
      if (t.id !== threadId) return t;
      return {
        ...t,
        entries: t.entries.filter(e => e.id !== entryId)
      };
    }));
  };

  // Delete a whole thread (Only allowed if owner or if it's a legacy thread with no owner)
  const handleDeleteThread = (threadId: string) => {
    const thread = threads.find(t => t.id === threadId);
    if (!thread) return;
    if (thread.ownerEmail && thread.ownerEmail !== currentUserEmail) {
      alert("Only the owner of this thread can delete it.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this entire recurring thread and ALL of its meeting entries?")) return;
    const updated = threads.filter(t => t.id !== threadId);
    setThreads(updated);
    if (activeThreadId === threadId) {
      const remainingVisible = updated.filter(t => currentUserEmail && (t.ownerEmail === currentUserEmail || t.allowedEmails?.includes(currentUserEmail)));
      setActiveThreadId(remainingVisible.length > 0 ? remainingVisible[0].id : null);
    }
  };

  // Create a new thread from the threads panel
  const handleCreateThreadInHub = (title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const newThread: MeetingThread = {
      id: "thread-" + Date.now(),
      title: trimmed,
      createdAt: new Date().toISOString().split("T")[0],
      entries: [],
      ownerEmail: currentUserEmail,
      allowedEmails: []
    };
    setThreads([...threads, newThread]);
    setActiveThreadId(newThread.id);
    setCreateThreadNameInput("");
  };

  // Add a member to a thread's access list
  const handleAddMemberToThread = (threadId: string, email: string) => {
    if (!email.trim()) return;
    setThreads(prev => prev.map(t => {
      if (t.id !== threadId) return t;
      if (t.ownerEmail !== currentUserEmail) {
        alert("Only the owner can manage access lists.");
        return t;
      }
      if (t.allowedEmails.includes(email)) return t;
      return {
        ...t,
        allowedEmails: [...t.allowedEmails, email]
      };
    }));
  };

  // Remove a member from a thread's access list
  const handleRemoveMemberFromThread = (threadId: string, email: string) => {
    setThreads(prev => prev.map(t => {
      if (t.id !== threadId) return t;
      if (t.ownerEmail !== currentUserEmail) {
        alert("Only the owner can manage access lists.");
        return t;
      }
      return {
        ...t,
        allowedEmails: t.allowedEmails.filter(e => e !== email)
      };
    }));
  };

  // Stage 2: Chronos Agent Function
  const runChronosAgent = async (participants?: Attendee[], targetDateStr?: string) => {
    if (!hasProcessed && !hasProcessedRef.current && !isExtracted && !isExtractedRef.current && !isExecuted && !isExecutedRef.current) {
      console.log('Pipeline blocked: Waiting for manual click.');
      return [];
    }
    setChronosStatus("running");
    const todayStr = new Date().toISOString().split("T")[0];
    const currentTargetDates = (!targetDateStr || targetDateStr < todayStr) ? (!referenceDate || referenceDate < todayStr ? todayStr : referenceDate) : targetDateStr;

    const safeAttendees = getDeduplicatedRoster(
      participants && participants.length > 0 ? participants : (attendees.length > 0 ? attendees : globalExtractedAttendeesRef.current),
      defaultHost.name,
      defaultHost.email
    );
    setAttendees(safeAttendees);

    const slots = await runChronosPipeline(safeAttendees, currentTargetDates, true);
    setProposedSlots(slots);
    if (slots.length > 0) {
      setChronosBestSlot(slots[0]);
      setSelectedSlotIndex(0);
    }

    const rosterNames = safeAttendees.map(a => a.name).join(", ");

    setChronosLogs([
      `[Chronos] 🤖 Agent initialized: Timezone Overlap Solver`,
      `[Chronos] Chronos processing for ${safeAttendees.length} attendees: [${rosterNames}]`,
      `[Chronos] Active business hour constraint: ${chronosConstraint === "core_only" ? "9 AM - 5 PM Core Only" : "8 AM - 6 PM Core/Shoulder"}`,
      `[Chronos] 📅 Queried Google Calendar Free/Busy API for attendee availability & timezones`,
      `[Chronos] Compiling local times for ${safeAttendees.length} members across ${new Set(safeAttendees.map(a => a.timezone)).size} timezones...`,
      `[Chronos] Computing best overlap intervals based on reference date: ${currentTargetDates}...`
    ]);
    setAgentLogs(prev => [
      ...prev,
      `🤖 [Chronos Scheduler] Chronos processing for ${safeAttendees.length} attendees: [${rosterNames}]`,
      `🤖 [Chronos Scheduler] Calculating global timezone compatibility & follow-up slots...`
    ]);

    await new Promise(r => setTimeout(r, 600));

    let bestSlot = slots[0] || null;
    if (slots.length > 0) {
      const perfect = slots.find(s => s.overallRating === "Perfect" || s.overallRating === "Good");
      if (perfect) bestSlot = perfect;
    }

    setChronosBestSlot(bestSlot);
    setSelectedSlotIndex(slots.indexOf(bestSlot));

    setChronosStatus("completed");
    setChronosLogs(prev => [
      ...prev,
      `[Chronos] Evaluated ${slots.length} schedule proposals.`,
      bestSlot
        ? `[Chronos] ✅ Optimal slot locked: ${bestSlot.utcDate.toLocaleDateString()} at ${bestSlot.utcDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} UTC`
        : `[Chronos] ⚠️ No high-overlap slot found within parameters.`,
      `[Chronos] Top 3 candidate slots proposed (ranked Gold, Silver, Bronze).`,
      `[Chronos] Selected Slot Overlap Score: ${bestSlot?.overallRating || "N/A"}`,
      `[Chronos] Formatted local .ics invite payload inside browser session.`
    ]);
    setAgentLogs(prev => [
      ...prev,
      `✅ [Chronos Scheduler] Generated Top 3 optimized timezone slots (Gold, Silver, Bronze)!`,
      `👉 Action Required: Select a slot card in the Decision Desk below to trigger Agent Scribe.`
    ]);

    return slots;
  };

  // --- Automated AI Agent Autopilot Trigger ---
  const handleDeployAutopilot = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();

    let transcriptData = transcript;
    if (!transcriptData.trim()) {
      setError("Please paste a meeting transcript or select a sample preset first.");
      return;
    }

    hasProcessedRef.current = true;
    setHasProcessed(true);
    isExtractedRef.current = true;
    setIsExtracted(true);

    setIsAutopilotRunning(true);
    setAgentStep("schedule");
    setError(null);
    setAgentLogs([]);
    setSmtpStatus("not_sent");
    setSmtpLogs([]);

    try {
      // Stage 1: Aura Agent Execution
      const auraResult = await runAuraAgent(transcriptData);

      // Stage 2: Automatic Chaining (Aura -> Chronos Handoff)
      if (auraResult) {
        await runChronosAgent(auraResult.participants || auraResult.attendees || attendees);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Automated Agent pipeline failed.");
      setAgentLogs(prev => [...prev, "❌ Workflow aborted due to technical interruption."]);
    } finally {
      setIsAutopilotRunning(false);
    }
  };

  const handleRunAgentAutopilot = handleDeployAutopilot;

  // --- STEP 3: EMAIL DRAFTER AGENT (SCRIBE) TRIGGERED MANUALLY ---
  const handleTriggerScribeDraft = async () => {
    if (!recapData) return;
    isExecutedRef.current = true;
    setIsExecuted(true);
    setIsAgentAutopilotRunning(true);
    setAgentStep("draft");
    setAgentLogs(prev => [
      ...prev,
      `🤖 [Scribe Communicator] Initializing draft generation around approved slot Option #${selectedSlotIndex + 1}...`
    ]);

    try {
      await runScribeAgent(meetingTitle, recapData, selectedSlot, scribeTone, attendees, duration);
      setAgentLogs(prev => [...prev, "✅ [Scribe Communicator] Follow-up email draft compiled and ready for review!"]);
      setAgentStep("complete");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Scribe Agent pipeline failed.");
      setAgentLogs(prev => [...prev, "❌ Scribe Agent aborted due to technical interruption."]);
    } finally {
      setIsAgentAutopilotRunning(false);
    }
  };

  // Helper to convert basic Markdown to styled HTML for Gmail rendering
  const convertMarkdownToHtml = (md: string): string => {
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

    // Replace headers (#### and ##### first, then ###, ##, #)
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

    // Wrap lists in <ul>
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
  };

  // --- Direct Send Handler via /api/send-email ---
  const handleSendDirectly = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();

    // 1. Auth Guard Check: Ensure user has a connected Email Account (Google OAuth or Universal SMTP)
    if (!isEmailConnected) {
      const noticeMsg = "No Outbox Connected. Please connect an email account above to dispatch directly from the app, or use the 'Copy Draft Content' button to paste this email into your preferred email provider.";
      setGmailConnectionWarning(noticeMsg);
      setError(noticeMsg);
      setSmtpStatus("error");
      setSmtpLogs([
        "Direct API Send ❌ DISPATCH BLOCKED: No outbox connected.",
        noticeMsg
      ]);
      setAgentLogs(prev => [
        ...prev,
        `[Direct API Send] ⚠️ ${noticeMsg}`
      ]);

      const connectCard = document.getElementById("email-account-connect-card") || document.getElementById("google-account-connect-card");
      if (connectCard) {
        connectCard.scrollIntoView({ behavior: "smooth", block: "center" });
        connectCard.classList.add("ring-2", "ring-indigo-500");
        setTimeout(() => {
          connectCard.classList.remove("ring-2", "ring-indigo-500");
        }, 2500);
      }
      return;
    }

    const activeRecipients = recipients.length > 0
      ? recipients
      : (attendees && attendees.length > 0 ? attendees.map(a => a.email).filter(Boolean) : []);

    if (activeRecipients.length === 0) {
      setError("Please add at least one email recipient address.");
      setSmtpStatus("error");
      setSmtpLogs([
        "Direct API Send ❌ FAILED: No recipient email addresses provided."
      ]);
      setAgentLogs(prev => [
        ...prev,
        "[Direct API Send] ❌ FAILED: No recipient email addresses provided."
      ]);
      return;
    }

    // 2. Recipient Validation Guard: Block dispatches to generic placeholder domains or invalid email syntax
    const recipientValidation = validateRecipientsList(activeRecipients);
    if (!recipientValidation.isValid) {
      const errorMsg = recipientValidation.message || "Invalid recipient address detected. Please update before sending.";
      const badAddresses = [...recipientValidation.placeholderEmails, ...recipientValidation.invalidEmails].join(", ");

      setError(errorMsg);
      setGmailConnectionWarning(errorMsg);
      setSmtpStatus("error");
      setSmtpLogs([
        `Direct API Send ❌ DISPATCH BLOCKED: ${errorMsg}`,
        `Direct API Send ⚠️ Problematic recipient address(es): ${badAddresses}`
      ]);
      setAgentLogs(prev => [
        ...prev,
        `[Direct API Send] ❌ DISPATCH BLOCKED: ${errorMsg} (${badAddresses})`
      ]);

      const recipientBox = document.getElementById("email-recipients-box");
      if (recipientBox) {
        recipientBox.scrollIntoView({ behavior: "smooth", block: "center" });
        recipientBox.classList.add("ring-2", "ring-rose-500");
        setTimeout(() => {
          recipientBox.classList.remove("ring-2", "ring-rose-500");
        }, 2500);
      }
      return;
    }

    setServerConnectionError(null);
    setSmtpStatus("sending");

    const activeSubject = emailSubject.trim() || (meetingTitle.trim() ? `Recap: ${meetingTitle.trim()}` : "Project Horizon Sync: Summary & Action Items");
    const activeBody = convertMarkdownToHtml(editedEmail);

    // Determine provider & sender email
    let activeConnectionType: "google" | "smtp" = "google";
    let activeProviderName = "Gmail / Google Workspace";
    let activeSenderEmail = driveUser?.email || currentUserEmail || defaultHost.email;

    if (emailConnectionType === "smtp" && isSmtpConnected) {
      activeConnectionType = "smtp";
      activeProviderName = smtpConfig.providerName || "Universal SMTP";
      activeSenderEmail = smtpConfig.senderEmail;
    } else if (isGoogleConnected) {
      activeConnectionType = "google";
      activeProviderName = "Gmail / Google Workspace";
      activeSenderEmail = driveUser?.email || currentUserEmail || defaultHost.email;
    } else if (isSmtpConnected) {
      activeConnectionType = "smtp";
      activeProviderName = smtpConfig.providerName || "Universal SMTP";
      activeSenderEmail = smtpConfig.senderEmail;
    }

    setSmtpLogs([
      `Direct API Send 🚀 Initiating direct email dispatch via /api/send-email (${activeProviderName})...`,
      `Direct API Send ✉️ Sender: <${activeSenderEmail}>`,
      `Direct API Send 👥 Recipients (${activeRecipients.length}): ${activeRecipients.join(", ")}`,
      `Direct API Send 📝 Subject: '${activeSubject}'`,
      `Direct API Send 📦 Draft payload size: ${activeBody.length} characters`
    ]);

    const serverConnErrorBannerText = "⚠️ Server Connection Error: Unable to reach the backend email dispatch server. Please check your backend connection or use 'Copy Plain Text Email'.";

    try {
      let response: Response;

      // Ensure access token is retrieved cleanly with local storage fallbacks
      const tokenToPass =
        driveAccessToken ||
        (typeof localStorage !== "undefined" ? localStorage.getItem("gcal_access_token") : null) ||
        (typeof localStorage !== "undefined" ? localStorage.getItem("google_access_token") : null);
      console.log("DEBUG: Token being sent to API:", tokenToPass);
      try {
        response = await fetch("/api/send-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": tokenToPass ? `Bearer ${tokenToPass}` : ""
          },
          body: JSON.stringify({
            connectionType: activeConnectionType,
            smtpConfig: activeConnectionType === "smtp" ? smtpConfig : null,
            token: tokenToPass,
            userAccessToken: tokenToPass, // Matches api/send-email.ts requirement
            senderEmail: activeSenderEmail,
            to: activeRecipients,
            subject: activeSubject,
            body: activeBody,
            bodyText: activeBody // Added for full backend compatibility
          })
        });
      } catch (networkFetchError: any) {
        // Network-level exception (e.g., Failed to fetch / Server offline / WebSocket timeout)
        console.error("Fetch network error:", networkFetchError);
        setSmtpStatus("error");
        setServerConnectionError(serverConnErrorBannerText);
        setError(serverConnErrorBannerText);
        setSmtpLogs(prev => [
          ...prev,
          "Direct API Send ❌ NETWORK ERROR: Server unreachable."
        ]);
        setAgentLogs(prev => [
          ...prev,
          "[Direct API Send] ❌ NETWORK ERROR: Server unreachable."
        ]);
        return;
      }

      const resultData = await response.json().catch(() => ({}));

      if (!response.ok || !resultData.success) {
        const errorMsg = resultData.error || resultData.message || `Server error (${response.status})`;

        // Check if server is offline / unreachable (502/503/504 or network message)
        if (
          response.status === 502 ||
          response.status === 503 ||
          response.status === 504 ||
          errorMsg.toLowerCase().includes("failed to fetch") ||
          errorMsg.toLowerCase().includes("server offline") ||
          errorMsg.toLowerCase().includes("websocket timeout") ||
          errorMsg.toLowerCase().includes("unreachable")
        ) {
          setSmtpStatus("error");
          setServerConnectionError(serverConnErrorBannerText);
          setError(serverConnErrorBannerText);
          setSmtpLogs(prev => [
            ...prev,
            "Direct API Send ❌ NETWORK ERROR: Server unreachable."
          ]);
          setAgentLogs(prev => [
            ...prev,
            "[Direct API Send] ❌ NETWORK ERROR: Server unreachable."
          ]);
          return;
        }

        throw new Error(errorMsg);
      }

      const providerName = resultData.providerName || activeProviderName;
      const senderEmail = resultData.senderEmail || activeSenderEmail;

      setSmtpStatus("sent");
      setServerConnectionError(null);
      setSmtpLogs(prev => [
        ...prev,
        `Direct API Send 🎉 SUCCESS! ${resultData.message || "Email delivered via direct API."}`,
        `Direct API Send 🆔 Message ID: ${resultData.messageId || 'N/A'}`,
        `Direct API Send 🏁 Transmission complete via ${providerName} (${senderEmail})!`
      ]);

      // Display exact log in the Activity Ledger per requirements:
      // [Direct API Send] ✅ Email successfully dispatched via [Provider Name] ([sender_email]).
      setAgentLogs(prev => [
        ...prev,
        `[Direct API Send] ✅ Email successfully dispatched via ${providerName} (${senderEmail}).`
      ]);
    } catch (err: any) {
      console.error("Direct send error:", err);
      const isNetworkErr = err.name === "TypeError" ||
        (err.message && (
          err.message.toLowerCase().includes("failed to fetch") ||
          err.message.toLowerCase().includes("server offline") ||
          err.message.toLowerCase().includes("websocket timeout") ||
          err.message.toLowerCase().includes("network error")
        ));

      setSmtpStatus("error");

      if (isNetworkErr) {
        setServerConnectionError(serverConnErrorBannerText);
        setError(serverConnErrorBannerText);
        setSmtpLogs(prev => [
          ...prev,
          "Direct API Send ❌ NETWORK ERROR: Server unreachable."
        ]);
        setAgentLogs(prev => [
          ...prev,
          "[Direct API Send] ❌ NETWORK ERROR: Server unreachable."
        ]);
      } else {
        const errMsg = err.message || "Failed to dispatch email directly.";
        setError(errMsg);
        setSmtpLogs(prev => [
          ...prev,
          `Direct API Send ❌ TRANSMISSION FAILED: ${errMsg}`
        ]);
        setAgentLogs(prev => [
          ...prev,
          `[Direct API Send] ❌ TRANSMISSION FAILED: ${errMsg}`
        ]);
      }
    }
  };

  // Get selected overlap slot
  const selectedSlot = useMemo(() => {
    if (proposedSlots.length === 0) return null;
    return proposedSlots[selectedSlotIndex] || proposedSlots[0];
  }, [proposedSlots, selectedSlotIndex]);

  const handleSelectSlot = async (slotOrIndex: number | ProposedSlot) => {
    let index = 0;
    let slot: ProposedSlot | null = null;

    if (typeof slotOrIndex === "number") {
      index = slotOrIndex;
      slot = proposedSlots[index] || null;
    } else {
      slot = slotOrIndex;
      index = proposedSlots.findIndex(s => s === slot);
      if (index === -1) index = 0;
    }

    setSelectedSlotIndex(index);
    if (slot) {
      setChronosBestSlot(slot);
    }

    const currentRecap = recapData;
    if (!currentRecap) return;

    // Trigger Agent Scribe for the selected slot
    setAgentStep("draft");
    setScribeStatus("running");
    setIsAgentAutopilotRunning(true);

    const slotLabel = slot
      ? `${slot.utcDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at ${slot.utcDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} UTC`
      : `Option #${index + 1}`;

    setAgentLogs(prev => [
      ...prev,
      `[Chronos -> Scribe] ⚡ Slot selected (${slotLabel}). Triggering Scribe Draft Generator...`,
      `🤖 [Scribe Communicator] Slot selected (${slotLabel}). Generating follow-up email draft...`
    ]);

    try {
      const activeTitle = meetingTitle.trim() || currentRecap.suggestedTitle || "Weekly Engineering Sync";
      const safeAttendees = (attendees && attendees.length > 0) ? attendees : globalExtractedAttendeesRef.current;

      await runScribeAgent(activeTitle, currentRecap, slot, scribeTone, safeAttendees, duration);

      setScribeStatus("completed");
      setAgentStep("complete");
      setAgentLogs(prev => [
        ...prev,
        `✅ [Scribe Communicator] Follow-up email draft compiled and loaded into Review Workspace!`,
        `🎉 [Orchestrator] AI Autopilot workflow fully executed and outputs unlocked!`
      ]);

      isExecutedRef.current = true;
      setIsExecuted(true);

      // Smooth scroll down to Scribe Email Review Workspace
      setTimeout(() => {
        const workspaceEl = document.getElementById("scribe-email-review-workspace") ||
          document.getElementById("email-draft-workspace") ||
          document.getElementById("scribe-workspace");
        if (workspaceEl) {
          workspaceEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to generate Scribe email draft.");
      setAgentLogs(prev => [...prev, "❌ [Scribe Communicator] Error generating draft."]);
    } finally {
      setIsAgentAutopilotRunning(false);
    }
  };

  const getFormattedSlotTimes = (slot: ProposedSlot) => {
    const roster = getDeduplicatedRoster(slot.attendeeLocalTimes, currentHostName, currentHostEmail);
    return roster.map(at => {
      let tzAbbr = "";
      try {
        const formatter = new Intl.DateTimeFormat("en-US", {
          timeZone: at.timezone,
          timeZoneName: "short"
        });
        const parts = formatter.formatToParts(slot.utcDate);
        const tzPart = parts.find(p => p.type === "timeZoneName");
        tzAbbr = tzPart ? tzPart.value : at.timezone.split("/").pop()?.replace("_", " ") || "UTC";
      } catch (e) {
        tzAbbr = at.timezone.split("/").pop()?.replace("_", " ") || "UTC";
      }

      let timeStr = "";
      try {
        timeStr = slot.utcDate.toLocaleTimeString("en-US", {
          timeZone: at.timezone,
          hour: "numeric",
          minute: "2-digit",
          hour12: true
        });
      } catch (e) {
        timeStr = at.localTimeStr.split(" - ")[1] || "";
      }

      return `${timeStr} ${tzAbbr} (${at.name})`;
    }).join(" | ");
  };

  const handleDownloadIcs = (slot: ProposedSlot, fileName: string) => {
    const title = meetingTitle || recapData?.suggestedTitle || "Follow-up";
    const desc = `Follow-up to review action items from "${title}".\n\nExecutive Summary:\n${recapData?.summary || ""}\n\nSuggested Agenda:\n${recapData?.suggestedAgenda ? recapData.suggestedAgenda.map((a, i) => `${i + 1}. ${a}`).join("\n") : ""}`;
    const url = generateIcsBlobUrl(title, desc, slot.utcDate, duration, attendees);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        // ignore
      }
    }, 1000);
  };

  // Automatically reset user-edited flag when a completely new meeting recap is loaded
  useEffect(() => {
    setHasUserEdited(false);
  }, [recapData]);

  // Regenerate email content whenever selected slot, recap, scribe tone, or host parameters update (only if user hasn't modified it)
  useEffect(() => {
    if (!isExecuted || !hasProcessed || !recapData || hasUserEdited) return;
    const emailBody = buildMarkdownRecapEmail(
      meetingTitle || recapData.suggestedTitle,
      recapData.summary,
      recapData.keyTopics,
      recapData.actionItems,
      recapData.suggestedAgenda,
      selectedSlot,
      duration,
      attendees
    );

    // Apply selected tone customization
    let tailoredEmail = emailBody;
    if (scribeTone === "casual") {
      tailoredEmail = emailBody
        .replace("Dear Team,", "Hey everyone! 👋")
        .replace("Please find the distilled recap, action items, and follow-up meeting proposals from our recent sync below.", "Here is a quick, relaxed recap of what we talked about and what's next on our plates.")
        .replace("Executive Summary", "What Went Down")
        .replace("Action Items & Deliverables", "Tasks & To-Dos ✅")
        .replace("Follow-up Sync Proposal", "Our Next Follow-up Chat 📅");
    } else if (scribeTone === "technical") {
      tailoredEmail = `### 💻 TECHNICAL RECAPPING & SYSTEMS COMPATIBILITY REPORT: ${(meetingTitle || recapData.suggestedTitle || "Weekly Sync").toUpperCase()}\n\n` + emailBody;
    }

    setEditedEmail(tailoredEmail);
  }, [isExecuted, hasProcessed, recapData, selectedSlot, duration, attendees, meetingTitle, scribeTone, hasUserEdited]);

  const handleResetDraft = () => {
    setHasUserEdited(false);
    if (!recapData) return;
    const emailBody = buildMarkdownRecapEmail(
      meetingTitle || recapData.suggestedTitle,
      recapData.summary,
      recapData.keyTopics,
      recapData.actionItems,
      recapData.suggestedAgenda,
      selectedSlot,
      duration,
      attendees
    );

    let tailoredEmail = emailBody;
    if (scribeTone === "casual") {
      tailoredEmail = emailBody
        .replace("Dear Team,", "Hey everyone! 👋")
        .replace("Please find the distilled recap, action items, and follow-up meeting proposals from our recent sync below.", "Here is a quick, relaxed recap of what we talked about and what's next on our plates.")
        .replace("Executive Summary", "What Went Down")
        .replace("Action Items & Deliverables", "Tasks & To-Dos ✅")
        .replace("Follow-up Sync Proposal", "Our Next Follow-up Chat 📅");
    } else if (scribeTone === "technical") {
      tailoredEmail = `### 💻 TECHNICAL RECAPPING & SYSTEMS COMPATIBILITY REPORT: ${(meetingTitle || recapData.suggestedTitle || "Weekly Sync").toUpperCase()}\n\n` + emailBody;
    }
    setEditedEmail(tailoredEmail);
  };

  const handleAutoShortenDraft = () => {
    if (!recapData) return;

    // Create an ultra-compact body keeping total characters minimal
    const compactSummary = recapData.summary.length > 180 ? recapData.summary.substring(0, 180) + "..." : recapData.summary;
    const compactTopics = recapData.keyTopics.slice(0, 3).map(t => `- **${t}**`).join("\n");
    const compactActions = recapData.actionItems.slice(0, 3).map(item => `- [ ] **${item.task}** (*${item.assignee}*)`).join("\n");

    let followUpStr = "";
    if (selectedSlot) {
      const utcFormatted = selectedSlot.utcDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + " " + selectedSlot.utcDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
      followUpStr = `**Next Sync:** ${utcFormatted} (${duration} mins)`;
    } else {
      followUpStr = `*No follow-up scheduled yet.*`;
    }

    const compactBody = `### Executive Meeting Recap: ${meetingTitle || recapData.suggestedTitle}

Dear Team, here is our ultra-concise sync summary & next steps:

#### 📌 Executive Summary
${compactSummary}

#### 🔑 Key Topics
${compactTopics}

#### ⬜ Action Items
${compactActions}

#### 📅 Follow-up Sync
${followUpStr}

---
*Drafted automatically.*`;

    setEditedEmail(compactBody);
    setHasUserEdited(true);
  };

  // Helper to convert markdown structure to formatted clean plain text email
  const convertMarkdownToPlainText = (md: string): string => {
    if (!md) return "";
    let text = md;
    // Strip headings, keep text
    text = text.replace(/^#+\s*(.*)$/gmi, '$1');
    // Replace horizontal lines
    text = text.replace(/^\s*---\s*$/gmi, '__________________________________________________');
    // Align checkboxes with simpler spacing
    text = text.replace(/-\s*\[\s*([ xX]*)\s*\]/g, '[$1]');
    // Strip bold text markers
    text = text.replace(/\*\*(.*?)\*\*/g, '$1');
    // Strip italics
    text = text.replace(/\*(.*?)\*/g, '$1');
    return text;
  };

  // Handle email draft copying
  const handleCopyEmail = () => {
    navigator.clipboard.writeText(editedEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(editedEmail);
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2000);
  };

  const handleCopyPlainText = () => {
    const plainText = convertMarkdownToPlainText(editedEmail);
    const fullCopy = emailSubject.trim() ? `Subject: ${emailSubject.trim()}\n\n${plainText}` : plainText;
    navigator.clipboard.writeText(fullCopy);
    setCopiedPlainText(true);
    setTimeout(() => setCopiedPlainText(false), 2000);
  };

  // Formats tasks into Jira markup table: || Action || Owner || Deadline || Next Steps ||
  const handleExportJira = () => {
    if (!recapData || !recapData.actionItems.length) return;
    let markup = "|| Task Title || Owner || Deadline || Next Steps ||\n";
    recapData.actionItems.forEach(item => {
      const task = item.task || "N/A";
      const owner = item.assignee || "Unassigned";
      const deadline = item.deadline || "Not specified";
      const nextSteps = item.nextSteps || "Not specified";
      markup += `| ${task} | ${owner} | ${deadline} | ${nextSteps} |\n`;
    });
    navigator.clipboard.writeText(markup);
    setCopiedFormat("jira");
    setTimeout(() => setCopiedFormat(null), 2500);
  };

  // Formats tasks into clean Markdown checkboxes: - [ ] **Task** @Owner (Due: Date) - *Next Steps: Steps*
  const handleExportMarkdown = () => {
    if (!recapData || !recapData.actionItems.length) return;
    const markdown = recapData.actionItems.map(item => {
      const task = item.task || "N/A";
      const owner = item.assignee || "Unassigned";
      const deadline = item.deadline || "Not specified";
      const nextSteps = item.nextSteps ? ` - *Next Steps: ${item.nextSteps}*` : "";
      return `- [ ] **${task}** @${owner} (Due: ${deadline})${nextSteps}`;
    }).join("\n");
    navigator.clipboard.writeText(markdown);
    setCopiedFormat("markdown");
    setTimeout(() => setCopiedFormat(null), 2500);
  };

  // Downloads CSV file formatted for Asana / Trello import
  const handleExportCSV = () => {
    if (!recapData || !recapData.actionItems.length) return;
    const headers = ["Task Title", "Owner", "Deadline", "Next Steps"];
    const csvContent = [
      headers.join(","),
      ...recapData.actionItems.map(item => {
        const row = [
          item.task || "",
          item.assignee || "",
          item.deadline || "",
          item.nextSteps || ""
        ];
        return row.map(val => {
          const escaped = val.replace(/"/g, '""');
          return `"${escaped}"`;
        }).join(",");
      })
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const cleanTitle = (meetingTitle || recapData.suggestedTitle || "action_items").trim().toLowerCase().replace(/\s+/g, "_");
    link.setAttribute("download", `action_items_${cleanTitle}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setCopiedFormat("csv");
    setTimeout(() => setCopiedFormat(null), 2500);
  };

  // Build mailto link for direct sending
  const mailtoLink = useMemo(() => {
    if (!recapData && !editedEmail) return "";
    const subject = encodeURIComponent(emailSubject || "Project Horizon Sync: Summary & Action Items");
    const body = encodeURIComponent(editedEmail);
    const to = recipients.filter(Boolean).join(",");
    return `mailto:${to}?subject=${subject}&body=${body}`;
  }, [recapData, editedEmail, recipients, emailSubject]);

  const mailtoLength = useMemo(() => mailtoLink.length, [mailtoLink]);
  const isMailtoTooLong = useMemo(() => mailtoLength > 2000, [mailtoLength]);

  const handleOpenEmailClient = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!mailtoLink) return;

    // Open in a fresh tab to preserve the active Cadence Desk app session
    window.open(mailtoLink, '_blank', 'noopener,noreferrer');
  };

  // Handle export workspace session (offline)
  const handleExportWorkspace = () => {
    try {
      const workspaceData = {
        version: "1.0",
        timestamp: new Date().toISOString(),
        currentUserEmail,
        meetingTitle,
        transcript,
        attendees,
        duration,
        referenceDate,
        recapData,
        proposedSlots: proposedSlots.map(s => ({
          ...s,
          utcDate: s.utcDate instanceof Date ? s.utcDate.toISOString() : s.utcDate
        })),
        selectedSlotIndex,
        threads
      };

      const blob = new Blob([JSON.stringify(workspaceData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const cleanTitle = (meetingTitle || recapData?.suggestedTitle || "cadence_workspace").trim().toLowerCase().replace(/\s+/g, "_");
      link.href = url;
      link.download = `cadence_workspace_${cleanTitle}_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setImportFeedback({
        type: "success",
        message: "Workspace file saved successfully!"
      });
      setTimeout(() => setImportFeedback(null), 5000);
    } catch (e) {
      console.error("Export workspace failed:", e);
      setImportFeedback({
        type: "error",
        message: "Failed to export workspace session."
      });
    }
  };

  // Handle import workspace session (offline)
  const handleImportWorkspace = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        let data: any;
        try {
          data = JSON.parse(content);
        } catch (parseErr) {
          throw new Error("The file is corrupted or is not valid JSON.");
        }

        if (!data || typeof data !== "object") {
          throw new Error("Invalid file structure. Must be a JSON object.");
        }

        // 1. Current User Email / Identity Role fallback if missing
        const finalCurrentUserEmail = (data.currentUserEmail && typeof data.currentUserEmail === "string")
          ? data.currentUserEmail
          : "your-email@domain.com";
        setCurrentUserEmail(finalCurrentUserEmail);

        // 2. Meeting Title
        const finalMeetingTitle = typeof data.meetingTitle === "string" ? data.meetingTitle : "Untitled Meeting";
        setMeetingTitle(finalMeetingTitle);

        // 3. Transcript
        const finalTranscript = typeof data.transcript === "string" ? data.transcript : "";
        setTranscript(finalTranscript);

        // 4. Attendees fallback (with default identity role if missing)
        let finalAttendees: Attendee[] = [];
        if (Array.isArray(data.attendees)) {
          finalAttendees = data.attendees.map((a: any, idx: number) => ({
            id: typeof a.id === "string" ? a.id : String(idx + 1),
            name: typeof a.name === "string" ? a.name : "Anonymous Attendee",
            email: typeof a.email === "string" ? a.email : `attendee-${idx + 1}@company.com`,
            timezone: typeof a.timezone === "string" ? a.timezone : "America/New_York",
            isHost: typeof a.isHost === "boolean" ? a.isHost : (idx === 0)
          }));
        } else {
          finalAttendees = [defaultHost];
        }
        setAttendees(finalAttendees);

        // 5. Duration
        const finalDuration = typeof data.duration === "number" ? data.duration : 45;
        setDuration(finalDuration);

        // 6. Reference Date
        const finalReferenceDate = typeof data.referenceDate === "string" ? data.referenceDate : new Date().toISOString().split("T")[0];
        setReferenceDate(finalReferenceDate);

        // 7. Recap Data fallback with empty arrays for missing action items/next steps
        if (data.recapData && typeof data.recapData === "object") {
          const rd = data.recapData;
          const finalRecapData = {
            suggestedTitle: typeof rd.suggestedTitle === "string" ? rd.suggestedTitle : finalMeetingTitle,
            summary: typeof rd.summary === "string" ? rd.summary : "",
            keyTopics: Array.isArray(rd.keyTopics) ? rd.keyTopics : [],
            suggestedAgenda: Array.isArray(rd.suggestedAgenda) ? rd.suggestedAgenda : [],
            isLocalFallback: typeof rd.isLocalFallback === "boolean" ? rd.isLocalFallback : false,
            actionItems: Array.isArray(rd.actionItems)
              ? rd.actionItems.map((item: any) => ({
                task: typeof item.task === "string" ? item.task : "Unspecified task",
                assignee: typeof item.assignee === "string" ? item.assignee : "Unassigned",
                deadline: typeof item.deadline === "string" ? item.deadline : undefined,
                nextSteps: typeof item.nextSteps === "string" ? item.nextSteps : "",
                completed: typeof item.completed === "boolean" ? item.completed : false
              }))
              : []
          };
          setRecapData(finalRecapData);
          setHasProcessed(true);
        } else {
          setRecapData(null);
          setHasProcessed(false);
        }

        // 8. Proposed Slots
        let finalProposedSlots: ProposedSlot[] = [];
        if (Array.isArray(data.proposedSlots)) {
          finalProposedSlots = data.proposedSlots.map((slot: any) => ({
            utcDate: slot.utcDate ? new Date(slot.utcDate) : new Date(),
            score: typeof slot.score === "number" ? slot.score : 0,
            overallRating: typeof slot.overallRating === "string" ? slot.overallRating : "Good",
            overallRatingLabel: typeof slot.overallRatingLabel === "string" ? slot.overallRatingLabel : "Good overlap",
            attendeeLocalTimes: Array.isArray(slot.attendeeLocalTimes)
              ? slot.attendeeLocalTimes.map((at: any) => ({
                attendeeId: typeof at.attendeeId === "string" ? at.attendeeId : "1",
                name: typeof at.name === "string" ? at.name : "Attendee",
                timezone: typeof at.timezone === "string" ? at.timezone : "America/New_York",
                localTimeStr: typeof at.localTimeStr === "string" ? at.localTimeStr : "",
                localHour: typeof at.localHour === "number" ? at.localHour : 12,
                status: typeof at.status === "string" ? at.status : "core",
                statusLabel: typeof at.statusLabel === "string" ? at.statusLabel : "Core hours"
              }))
              : []
          }));
        }
        setProposedSlots(finalProposedSlots);

        // 9. Selected Slot Index
        const finalSelectedSlotIndex = typeof data.selectedSlotIndex === "number" ? data.selectedSlotIndex : 0;
        setSelectedSlotIndex(finalSelectedSlotIndex);

        // 10. Threads & fallback empty arrays for missing threads/entries
        let finalThreads: MeetingThread[] = [];
        if (Array.isArray(data.threads)) {
          finalThreads = data.threads.map((t: any) => ({
            id: typeof t.id === "string" ? t.id : `thread-${Math.random().toString(36).substring(2, 9)}`,
            title: typeof t.title === "string" ? t.title : "Untitled Thread",
            createdAt: typeof t.createdAt === "string" ? t.createdAt : new Date().toISOString().split("T")[0],
            ownerEmail: typeof t.ownerEmail === "string" ? t.ownerEmail : "your-email@domain.com",
            allowedEmails: Array.isArray(t.allowedEmails) ? t.allowedEmails : [],
            entries: Array.isArray(t.entries)
              ? t.entries.map((entry: any) => ({
                id: typeof entry.id === "string" ? entry.id : `entry-${Math.random().toString(36).substring(2, 9)}`,
                dateStr: typeof entry.dateStr === "string" ? entry.dateStr : new Date().toISOString().split("T")[0],
                meetingTitle: typeof entry.meetingTitle === "string" ? entry.meetingTitle : "Untitled Meeting",
                recapTitle: typeof entry.recapTitle === "string" ? entry.recapTitle : "Untitled Recap",
                summary: typeof entry.summary === "string" ? entry.summary : "",
                keyTopics: Array.isArray(entry.keyTopics) ? entry.keyTopics : [],
                suggestedAgenda: Array.isArray(entry.suggestedAgenda) ? entry.suggestedAgenda : [],
                actionItems: Array.isArray(entry.actionItems)
                  ? entry.actionItems.map((item: any) => ({
                    task: typeof item.task === "string" ? item.task : "Unspecified task",
                    assignee: typeof item.assignee === "string" ? item.assignee : "Unassigned",
                    deadline: typeof item.deadline === "string" ? item.deadline : undefined,
                    nextSteps: typeof item.nextSteps === "string" ? item.nextSteps : "",
                    completed: typeof item.completed === "boolean" ? item.completed : false
                  }))
                  : [],
                selectedSlot: entry.selectedSlot && typeof entry.selectedSlot === "object"
                  ? {
                    dateStr: typeof entry.selectedSlot.dateStr === "string" ? entry.selectedSlot.dateStr : "",
                    timeStr: typeof entry.selectedSlot.timeStr === "string" ? entry.selectedSlot.timeStr : ""
                  }
                  : null
              }))
              : []
          }));
        }
        setThreads(finalThreads);

        if (finalThreads.length > 0) {
          setActiveThreadId(finalThreads[0].id);
        } else {
          setActiveThreadId(null);
        }

        // 11. Custom field fallback (e.g., fallback empty arrays for missing ranks)
        const finalRanks = Array.isArray(data.ranks) ? data.ranks : [];

        const threadCount = finalThreads.length;
        const entryCount = finalThreads.reduce((acc: number, t: any) => acc + (t.entries?.length || 0), 0);
        setImportFeedback({
          type: "success",
          message: `Restored ${threadCount} thread(s) (${entryCount} logs) and ${finalAttendees.length} attendee(s)!`
        });

        // Reset file input
        event.target.value = "";
        setTimeout(() => setImportFeedback(null), 8000);
      } catch (err: any) {
        console.error("Import workspace failed:", err);
        setImportFeedback({
          type: "error",
          message: `Restore failed: ${err.message || "Invalid file content."}`
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="relative min-h-screen bg-[#F8FAFC]">
      {/* Workspace Content (Blurred and Non-Interactive until Legal Consent is Accepted) */}
      <div className={`min-h-screen bg-[#F8FAFC] text-slate-900 font-sans antialiased selection:bg-indigo-100 selection:text-indigo-900 transition-all ${!isLegalAccepted ? "blur-sm pointer-events-none select-none overflow-hidden h-screen" : ""}`}>
        {/* Upper Navigation Header */}
        <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-40 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-white rotate-45"></div>
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-800 uppercase">
                CADENCE DESK <span className="text-indigo-600 font-normal opacity-60 text-[10px] font-mono lowercase">v1.0</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-mono tracking-tight leading-none">
                Recap & Follow-up Timezone Engine
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500">
            {/* File Menu / Save & Restore Workspace Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsSaveRestoreMenuOpen(!isSaveRestoreMenuOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-300 bg-slate-50 hover:bg-white text-slate-700 text-xs font-bold shadow-2xs transition-all cursor-pointer"
                title="Save & Restore Workspace File"
              >
                <FolderSync className="w-3.5 h-3.5 text-indigo-600" />
                <span>File</span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isSaveRestoreMenuOpen ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
                {isSaveRestoreMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsSaveRestoreMenuOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-700 flex items-center gap-1.5 font-mono">
                          <FolderSync className="w-3.5 h-3.5 text-indigo-600" />
                          SAVE & RESTORE WORKSPACE
                        </h3>
                        <span className="bg-indigo-50 text-indigo-700 text-[9px] font-bold px-1.5 py-0.5 rounded font-mono uppercase tracking-wider">
                          JSON File
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 leading-relaxed text-left font-normal">
                        Save your active workspace to your computer, or open a saved workspace file to pick up where you left off.
                      </p>

                      <div className="grid grid-cols-1 gap-2 pt-1">
                        <button
                          onClick={() => {
                            handleExportWorkspace();
                          }}
                          className="w-full bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-300 text-slate-700 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
                        >
                          <Download className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Save Workspace File</span>
                        </button>

                        <label className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer text-center shadow-xs select-none">
                          <FolderSync className="w-3.5 h-3.5" />
                          <span>Open Saved Workspace</span>
                          <input
                            type="file"
                            accept=".json"
                            className="hidden"
                            onChange={(e) => {
                              handleImportWorkspace(e);
                            }}
                          />
                        </label>
                      </div>

                      {importFeedback && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`text-[10px] p-2.5 rounded-lg border font-semibold flex items-start gap-1.5 text-left leading-normal ${importFeedback.type === "success"
                            ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                            : "bg-red-50 border-red-100 text-red-800"
                            }`}
                        >
                          {importFeedback.type === "success" ? (
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          ) : (
                            <Info className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                          )}
                          <span>{importFeedback.message}</span>
                        </motion.div>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Colleague Profile & Auth Controls */}
            {currentUserEmail ? (
              <div className="flex items-center gap-2 bg-slate-100/90 border border-slate-200 rounded-lg p-1.5">
                <div className="flex items-center gap-2 px-2 py-0.5 bg-white rounded border border-slate-200 shadow-3xs">
                  <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                    {currentUserEmail.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-bold text-slate-800 truncate max-w-[130px]">
                      {userProfiles.find(p => p.email === currentUserEmail)?.name || currentUserEmail.split("@")[0]}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono truncate max-w-[130px]">
                      {currentUserEmail}
                    </span>
                  </div>
                </div>

                {/* Profile Selector if multiple exist */}
                {userProfiles.length > 1 && (
                  <select
                    value={currentUserEmail}
                    onChange={(e) => handleIdentityChange(e.target.value)}
                    className="text-[11px] font-bold text-indigo-700 bg-white border border-slate-200 rounded-md py-1 px-1.5 focus:ring-1 focus:ring-indigo-500 cursor-pointer hidden md:block"
                    title="Switch Profile"
                  >
                    {userProfiles.map((p, idx) => (
                      <option key={`${p.email}-${idx}`} value={p.email}>
                        👤 {p.name}
                      </option>
                    ))}
                    <option value="__CREATE_NEW__">➕ Add Profile...</option>
                  </select>
                )}

                <button
                  onClick={() => {
                    const current = userProfiles.find(p => p.email === currentUserEmail);
                    if (current) {
                      setSetupName(current.name);
                      setSetupEmail(current.email);
                      setSetupTimezone(current.timezone || "America/New_York");
                      setSetupPassword(userPasswords[current.email] || "");
                      setAuthModalMode("edit");
                    } else {
                      setSetupName("");
                      setSetupEmail(currentUserEmail);
                      setSetupPassword("");
                      setAuthModalMode("login");
                    }
                    setSetupError(null);
                    setIsSetupModalOpen(true);
                  }}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded border border-indigo-200 transition-colors cursor-pointer whitespace-nowrap hidden sm:inline-block"
                  title="Edit active profile & password"
                >
                  Edit
                </button>

                {/* Log Out Button */}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer"
                  title="Log Out of workspace"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Log Out</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-mono hidden md:inline">Guest Mode</span>
                <button
                  onClick={() => {
                    setSetupName("");
                    setSetupEmail("");
                    setSetupPassword("");
                    setAuthModalMode("login");
                    setSetupError(null);
                    setIsSetupModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition-all cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Log In / Sign Up</span>
                </button>
              </div>
            )}

            <span className="hidden sm:flex items-center gap-1.5 font-mono text-[10px] tracking-wide text-slate-400">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              SYSTEM READY
            </span>
          </div>
        </header>

        {/* Main Content Body Container */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* LEFT COLUMN: Input Control Panel (5 Cols) */}
            <section className="lg:col-span-5 space-y-6">

              {/* ATTENDEES LIST & TIMEZONES */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                  <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                    Attendees & Timezones ({attendees.length})
                  </h2>
                  <div className="text-[10px] text-slate-400 font-mono">
                    1 Host Required
                  </div>
                </div>

                {/* Attendee Form */}
                <div className="bg-slate-50/50 rounded-lg p-3 mb-3 border border-slate-100 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Liam Foster"
                        value={newAttendeeName}
                        onChange={(e) => setNewAttendeeName(e.target.value)}
                        className="w-full text-[11px] mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Email</label>
                      <input
                        type="email"
                        placeholder="liam@company.com"
                        value={newAttendeeEmail}
                        onChange={(e) => setNewAttendeeEmail(e.target.value)}
                        className="w-full text-[11px] mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Timezone</label>
                    <select
                      value={newAttendeeTimezone}
                      onChange={(e) => setNewAttendeeTimezone(e.target.value)}
                      className="w-full text-[11px] mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded focus:outline-hidden"
                    >
                      {PRESET_TIMEZONES.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                          {tz.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleAddAttendee}
                    className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 py-1 rounded text-[11px] font-bold flex items-center justify-center gap-1 transition-colors shadow-xs"
                  >
                    <Plus className="w-3 h-3" /> Add Attendee
                  </button>
                </div>

                {/* Render Attendee Cards */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {attendees.map((a) => (
                    <div
                      key={a.id}
                      className={`flex items-center justify-between p-2 rounded-lg border transition-all ${a.isHost
                        ? "bg-indigo-50/50 border-indigo-100 text-indigo-950"
                        : "bg-white border-slate-150 hover:border-slate-300"
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSetHost(a.id)}
                          title={a.isHost ? "Meeting Host (Core Zone)" : "Click to set as Host"}
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${a.isHost
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-750"
                            }`}
                        >
                          {a.isHost ? "Host" : "Guest"}
                        </button>
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold truncate text-slate-800">{a.name}</div>
                          <div className="text-[9px] text-slate-500 flex items-center gap-1 font-mono leading-none flex-wrap">
                            <span className="truncate max-w-[120px]">{a.email || "no-email@company.com"}</span>
                            {a.email && (isPlaceholderDomain(a.email) || !isValidEmailSyntax(a.email)) && (
                              <span
                                className="text-[8px] bg-amber-100 text-amber-800 border border-amber-300/80 rounded px-1 py-0.2 font-mono font-bold shrink-0"
                                title="Invalid recipient address detected. Please update before sending."
                              >
                                Placeholder Email
                              </span>
                            )}
                            <span>•</span>
                            <span className="text-indigo-600 font-bold shrink-0">{a.timezone.split("/").pop()?.replace("_", " ")}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveAttendee(a.id)}
                        className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-slate-50 transition-colors"
                        title="Remove Attendee"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. INPUT TRANSCRIPT & SCHEDULING DETAILS */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3.5">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    Input: Raw Transcript
                  </h2>
                  {transcript.trim() ? (
                    <span className="text-[10px] text-slate-400 font-mono">
                      {transcript.trim().split(/\s+/).length} words
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-mono">Empty</span>
                  )}
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                    Meeting Title (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sprint Review Sync"
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                {/* File Import Drag and Drop Zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsFileDragging(true); }}
                  onDragLeave={() => setIsFileDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsFileDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleFileDropOrSelect(e.dataTransfer.files[0]);
                    }
                  }}
                  className={`border-2 border-dashed rounded-xl p-4 text-center transition-all ${isFileDragging
                    ? "border-indigo-500 bg-indigo-50/50 shadow-inner"
                    : "border-slate-200 bg-slate-50/20 hover:bg-slate-50/50 hover:border-indigo-300"
                    }`}
                >
                  <input
                    type="file"
                    id="doc-upload"
                    accept=".docx,.doc,.txt"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileDropOrSelect(e.target.files[0]);
                      }
                    }}
                  />

                  <label htmlFor="doc-upload" className="cursor-pointer flex flex-col items-center justify-center">
                    <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2">
                      <Download className="w-4 h-4 rotate-180" />
                    </div>
                    <div className="text-[11px] font-bold text-slate-700">
                      {isParsingFile ? "Extracting content..." : "Upload Word Document or TXT"}
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1 font-mono">
                      Drag & drop or <span className="text-indigo-600 font-semibold underline">browse</span> (.docx, .doc, .txt)
                    </p>
                  </label>

                  {isParsingFile && (
                    <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[10px] text-indigo-600 font-medium">
                      <svg className="animate-spin h-3.5 w-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Parsing document content...
                    </div>
                  )}

                  {parsedFileName && !isParsingFile && (
                    <div className="mt-2 text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-lg p-1.5 flex items-center justify-center gap-1.5 font-medium">
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="truncate max-w-[180px]">Loaded: {parsedFileName}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setParsedFileName(null);
                          setTranscript("");
                          setExtractedSpeakers([]);
                        }}
                        className="text-slate-450 hover:text-red-500 font-bold ml-1 text-xs"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  {fileError && (
                    <div className="mt-2 text-[10px] bg-red-50 text-red-800 border border-red-100 rounded-lg p-1.5 text-center font-medium">
                      {fileError}
                    </div>
                  )}
                </div>

                {/* Google Drive Import Option */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleOpenDriveImport}
                    className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs hover:border-slate-300"
                  >
                    <Cloud className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>Import from Google Drive</span>
                  </button>
                </div>

                {/* Intelligent Extracted Attendees Panel */}
                {extractedSpeakers.length > 0 && (
                  <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-indigo-600" />
                        Extracted Speakers Detected ({extractedSpeakers.length})
                      </h3>
                      <button
                        onClick={() => {
                          const newAttendees = [...attendees];
                          extractedSpeakers.forEach((s) => {
                            if (!newAttendees.some(na => na.name.toLowerCase() === s.name.toLowerCase())) {
                              newAttendees.push({
                                id: String(Date.now() + Math.random()),
                                name: s.name,
                                email: `${s.name.toLowerCase().replace(/\s+/g, ".")}@company.com`,
                                timezone: s.timezone
                              });
                            }
                          });
                          setAttendees(newAttendees);
                          setExtractedSpeakers([]);
                        }}
                        className="text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2 py-1 rounded transition-colors cursor-pointer"
                      >
                        Import All
                      </button>
                    </div>
                    <p className="text-[10px] text-indigo-800 leading-normal">
                      We found the following participants in the document who aren't in your list. Add them to sync timezones automatically:
                    </p>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
                      {extractedSpeakers.map((s, idx) => (
                        <div
                          key={idx}
                          className="bg-white border border-indigo-100 text-slate-800 rounded-full px-2.5 py-1 text-[10px] flex items-center gap-1 font-medium shadow-2xs"
                        >
                          <span className="font-semibold text-indigo-900">{s.name}</span>
                          <span className="text-slate-400 font-mono text-[9px]">({s.timezone.split("/").pop()})</span>
                          <button
                            onClick={() => {
                              if (!attendees.some(na => na.name.toLowerCase() === s.name.toLowerCase())) {
                                setAttendees([
                                  ...attendees,
                                  {
                                    id: String(Date.now() + Math.random()),
                                    name: s.name,
                                    email: `${s.name.toLowerCase().replace(/\s+/g, ".")}@company.com`,
                                    timezone: s.timezone
                                  }
                                ]);
                              }
                              setExtractedSpeakers(extractedSpeakers.filter((_, i) => i !== idx));
                            }}
                            className="text-indigo-600 hover:text-indigo-800 font-bold ml-1 cursor-pointer"
                            title="Import attendee"
                          >
                            +
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] uppercase font-bold text-slate-500 block">
                      Raw Transcript / Dialogue
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (SAMPLE_TRANSCRIPTS && SAMPLE_TRANSCRIPTS.length > 0) {
                          const sample = SAMPLE_TRANSCRIPTS[0];
                          setTranscript(sample.transcript);
                          if (sample.title) setMeetingTitle(sample.title);
                          if (sample.attendees && sample.attendees.length > 0) {
                            setAttendees(sample.attendees);
                          }
                        }
                      }}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 border border-indigo-200/60 shadow-3xs"
                    >
                      <Sparkles className="w-3 h-3 text-indigo-500" />
                      Load Sample Transcript
                    </button>
                  </div>
                  <textarea
                    placeholder="Paste raw conversation, chat transcript, or bulleted summary here..."
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    rows={8}
                    className="w-full text-xs p-3 bg-white border border-slate-200 rounded focus:outline-hidden focus:border-indigo-500 font-mono resize-y"
                  />
                </div>

                {/* Output Granularity Toggle Button Group */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-505 block flex items-center justify-between">
                    <span className="text-slate-500 font-bold">Output Granularity</span>
                    <span className="text-[9px] text-indigo-600 font-mono font-bold capitalize">
                      {auraTone === "standard" ? "Standard Balanced" : auraTone === "detailed" ? "In-depth Exhaustive" : "High-Priority Only"}
                    </span>
                  </label>
                  <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-3xs">
                    <button
                      type="button"
                      onClick={() => setAuraTone("standard")}
                      className={`text-[10px] font-bold py-1.5 rounded-lg transition-all cursor-pointer text-center ${auraTone === "standard"
                        ? "bg-white text-indigo-700 shadow-xs border border-slate-200/50"
                        : "text-slate-600 hover:text-slate-900 border border-transparent"
                        }`}
                    >
                      Standard
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuraTone("detailed")}
                      className={`text-[10px] font-bold py-1.5 rounded-lg transition-all cursor-pointer text-center ${auraTone === "detailed"
                        ? "bg-white text-indigo-700 shadow-xs border border-slate-200/50"
                        : "text-slate-600 hover:text-slate-900 border border-transparent"
                        }`}
                    >
                      Exhaustive
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuraTone("high_priority")}
                      className={`text-[10px] font-bold py-1.5 rounded-lg transition-all cursor-pointer text-center ${auraTone === "high_priority"
                        ? "bg-white text-indigo-700 shadow-xs border border-slate-200/50"
                        : "text-slate-600 hover:text-slate-900 border border-transparent"
                        }`}
                    >
                      High-Priority
                    </button>
                  </div>
                </div>

                {/* Time Overlap Parameters (Auto-populated by AI upon extraction, editable) */}
                <div className="bg-slate-50/50 p-3 rounded border border-slate-100 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Scheduling Parameters</span>
                    <span className="text-[9px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 text-indigo-600" />
                      AI Auto-Extracted
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-0.5">
                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-500 block mb-0.5">
                        Duration
                      </label>
                      <select
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                        className="w-full text-xs px-2 py-1 bg-white border border-slate-200 rounded focus:outline-hidden"
                      >
                        <option value={15}>15 Minutes</option>
                        <option value={30}>30 Minutes</option>
                        <option value={45}>45 Minutes</option>
                        <option value={60}>60 Minutes</option>
                        <option value={90}>90 Minutes</option>
                        <option value={120}>120 Minutes</option>
                        {![15, 30, 45, 60, 90, 120].includes(duration) && (
                          <option value={duration}>{duration} Minutes</option>
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-500 block mb-0.5">
                        Target Date
                      </label>
                      <input
                        type="date"
                        value={referenceDate}
                        onChange={(e) => setReferenceDate(e.target.value)}
                        className="w-full text-xs px-2 py-0.5 bg-white border border-slate-200 rounded focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Trigger Action */}
                <button
                  type="button"
                  onClick={handleProcessTranscript}
                  disabled={isLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Extracting...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Extract Intelligence</span>
                    </>
                  )}
                </button>

                {/* Dynamic Loading Status Line */}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-indigo-50/50 text-indigo-800 text-[10px] p-2 rounded-lg text-center font-mono border border-indigo-100"
                  >
                    <span className="inline-block animate-pulse mr-1">●</span> {loadingStep}
                  </motion.div>
                )}
              </div>

            </section>

            {/* RIGHT COLUMN: Interactive Workspaces / Tabs (7 Cols) */}
            <section className="lg:col-span-7">

              {/* Error Message banner */}
              {error && (
                <div className="bg-red-50 text-red-800 p-3.5 rounded-lg border border-red-200 text-xs mb-5 flex items-start gap-2">
                  <span className="font-bold text-red-600">Error:</span>
                  <p>{error}</p>
                </div>
              )}

              {!((isExtracted || isExecuted) && recapData) ? (
                /* Welcome / Empty Placeholder state */
                <div className="bg-white border border-slate-200 rounded-xl p-8 md:p-12 text-center shadow-sm flex flex-col items-center justify-center min-h-[480px]">
                  <div className="bg-indigo-50 text-indigo-600 p-3.5 rounded-full border border-indigo-100 mb-4">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Ready to Distill Your Meeting Recap
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mb-5">
                    Paste raw meeting transcription scripts or upload an audio/transcript file on the left to extract actions and schedules instantly.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md text-left mb-2">
                    <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                        Recap Extract
                      </h4>
                      <p className="text-[10px] text-slate-550 leading-relaxed">
                        AI analyzes conversation to map action items with precise owners and deadlines automatically.
                      </p>
                    </div>
                    <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-1">
                        <Globe className="w-3.5 h-3.5 text-emerald-500" />
                        Timezone Solver
                      </h4>
                      <p className="text-[10px] text-slate-550 leading-relaxed">
                        Evaluates working hour compatibility across Tokyo, London, Paris, and US zones in seconds.
                      </p>
                    </div>
                  </div>

                  {/* Existing Threads View section */}
                  <div className="w-full max-w-md mt-6 pt-5 border-t border-slate-150 text-left">
                    <div className="flex items-center justify-between mb-2.5">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-indigo-500" />
                        Existing Recurring Threads ({visibleThreads.length})
                      </h4>
                      <button
                        onClick={() => {
                          if (!currentUser) {
                            setIsSetupModalOpen(true);
                          } else {
                            setActiveTab("threads");
                          }
                        }}
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold transition-colors cursor-pointer"
                      >
                        View All Hub →
                      </button>
                    </div>

                    {visibleThreads.length === 0 ? (
                      <div className="bg-slate-50/40 border border-dashed border-slate-200 rounded-lg p-4 text-center text-[11px] text-slate-450 italic">
                        {currentUserEmail ? "No authorized threads found for your account." : "Log in or select a profile to view authorized threads."}
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                        {visibleThreads.slice(0, 3).map((t) => {
                          const allTasks = t.entries.flatMap(e => e.actionItems);
                          const completedCount = allTasks.filter(item => item.completed).length;
                          const totalCount = allTasks.length;

                          return (
                            <div
                              key={t.id}
                              onClick={() => {
                                setActiveThreadId(t.id);
                                setActiveTab("threads");
                              }}
                              className="bg-slate-50/60 hover:bg-indigo-50/45 border border-slate-150 hover:border-indigo-200 p-2.5 rounded-lg transition-all cursor-pointer flex items-center justify-between gap-3 group"
                            >
                              <div className="min-w-0 flex-1">
                                <h5 className="text-[11px] font-bold text-slate-700 group-hover:text-indigo-950 transition-colors truncate">
                                  {t.title}
                                </h5>
                                <p className="text-[9px] text-slate-450 mt-0.5 font-mono">
                                  {t.entries.length} logged session{t.entries.length !== 1 ? "s" : ""} • {completedCount}/{totalCount} tasks completed
                                </p>
                              </div>
                              <div className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 shrink-0">
                                Open
                                <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                              </div>
                            </div>
                          );
                        })}
                        {visibleThreads.length > 3 && (
                          <p className="text-[10px] text-center text-slate-400 mt-1">
                            + {visibleThreads.length - 3} more threads in the hub
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Active Workspace Output Panel with Tab Controls */
                <div className="space-y-4">
                  {recapData?.isLocalFallback && (
                    <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-800 flex items-start gap-2.5 shadow-xs">
                      <span className="p-1 rounded-md bg-amber-100 text-amber-600 shrink-0">
                        <Sparkles className="w-4 h-4 animate-pulse" />
                      </span>
                      <div className="space-y-0.5">
                        <div className="font-bold uppercase tracking-wider text-[10px] text-amber-700 font-mono">Offline Smart Parser Engaged</div>
                        <p className="text-[11px] leading-relaxed text-amber-800">
                          The Gemini API is currently experiencing high demand (503 Service Unavailable).
                          To keep your workspace fully functional, we've automatically activated our robust local semantic parser to distill your recap.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Visual Tab Navigation Headers */}
                  <div className="bg-slate-100/80 rounded-xl p-1 border border-slate-200/60 shadow-xs flex flex-wrap gap-1">
                    <button
                      onClick={() => setActiveTab("agents")}
                      className={`flex-1 min-w-[110px] px-2.5 py-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === "agents"
                        ? "bg-indigo-600 text-white shadow-sm font-extrabold"
                        : "text-indigo-600 hover:text-indigo-900 hover:bg-white/45 font-bold bg-indigo-50/40"
                        }`}
                    >
                      <Bot className="w-3.5 h-3.5" />
                      AI Autopilot
                    </button>
                    <button
                      onClick={() => setActiveTab("recap")}
                      className={`flex-1 min-w-[110px] px-2.5 py-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === "recap"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/45"
                        }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Recap & Tasks
                    </button>
                    <button
                      onClick={() => setActiveTab("overlap")}
                      className={`flex-1 min-w-[110px] px-2.5 py-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === "overlap"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/45"
                        }`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      Timezone Overlap
                    </button>
                    <button
                      onClick={() => setActiveTab("calendar")}
                      className={`flex-1 min-w-[110px] px-2.5 py-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === "calendar"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/45"
                        }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      Invites (.ics)
                    </button>
                    <button
                      onClick={() => setActiveTab("email")}
                      className={`flex-1 min-w-[110px] px-2.5 py-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === "email"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/45"
                        }`}
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Email Draft
                    </button>
                    <button
                      onClick={() => {
                        if (!currentUser) {
                          setIsSetupModalOpen(true);
                        } else {
                          setActiveTab("threads");
                        }
                      }}
                      className={`flex-1 min-w-[110px] px-2.5 py-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === "threads"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/45"
                        }`}
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Recurring Threads</span>
                      {!currentUser && <span className="text-[10px] ml-0.5" title="Primary Account Required">🔒</span>}
                    </button>
                  </div>

                  {/* Tab content wrappers */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm min-h-[480px]">

                    {/* TAB 0: AI AGENTS AUTOPILOT ENGINE */}
                    {activeTab === "agents" && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6 animate-fadeIn"
                      >
                        {/* Top Hero Banner */}
                        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 rounded-xl p-5 text-white shadow-md relative overflow-hidden border border-indigo-900/30">
                          <div className="absolute top-0 right-0 p-4 opacity-15">
                            <Bot className="w-24 h-24 stroke-[1]" />
                          </div>
                          <div className="relative z-10 space-y-3 text-left">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="bg-indigo-500/20 border border-indigo-400/30 text-[9px] font-bold font-mono px-2 py-0.5 rounded-full uppercase tracking-wider text-indigo-300">
                                Enterprise AI Orchestrator
                              </span>
                              {isAgentAutopilotRunning && (
                                <span className="bg-emerald-500/25 border border-emerald-400/40 text-[9px] font-bold font-mono px-2 py-0.5 rounded-full uppercase tracking-wider text-emerald-300 animate-pulse">
                                  Autopilot Engaged
                                </span>
                              )}
                            </div>

                            <div className="max-w-xl">
                              <h3 className="text-sm font-extrabold tracking-tight">AI Agent Workflow Autopilot</h3>
                              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                                Configure and deploy autonomous agents to handle meeting summaries, timezone optimization, follow-up invites, and reviewable team draft transmissions on autopilot.
                              </p>
                            </div>

                            <div className="pt-2 flex flex-wrap items-center gap-3">
                              <button
                                type="button"
                                disabled={isAutopilotRunning || auraStatus === "running" || chronosStatus === "running"}
                                onClick={handleDeployAutopilot}
                                className="bg-white hover:bg-slate-100 disabled:opacity-45 text-indigo-950 font-bold px-4 py-2 rounded-lg text-xs transition-all cursor-pointer shadow-md flex items-center gap-2"
                              >
                                {(isAutopilotRunning || auraStatus === "running" || chronosStatus === "running") ? (
                                  <>
                                    <Zap className="w-4 h-4 animate-pulse text-amber-500" />
                                    <span>⚡ Autopilot in Progress...</span>
                                  </>
                                ) : (auraStatus === "completed" && chronosStatus === "completed" && scribeStatus !== "completed") ? (
                                  <>
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    <span>✅ Awaiting Slot Selection</span>
                                  </>
                                ) : (
                                  <>
                                    <Play className="w-4 h-4 fill-indigo-950 text-indigo-950" />
                                    <span>▶ Deploy Autopilot Workflow</span>
                                  </>
                                )}
                              </button>

                              <button
                                onClick={handleResetWorkspace}
                                className="bg-indigo-900/40 hover:bg-indigo-900/80 text-indigo-200 hover:text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-indigo-800/20"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Reset Workspace
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Visual Pipeline Stepper Tracker */}
                        <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-150 shadow-2xs">
                          <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 font-mono mb-4 text-left">
                            Workflow Pipeline Execution Matrix
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 relative">
                            {/* Step 1: Aura */}
                            <div className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all text-left ${auraStatus === "running" ? "bg-indigo-50/40 border-indigo-300 shadow-xs" :
                              auraStatus === "completed" ? "bg-emerald-50/25 border-emerald-200 opacity-90" : "bg-white border-slate-200/80"
                              }`}>
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold font-mono shrink-0 ${auraStatus === "completed" ? "bg-emerald-500 text-white" :
                                auraStatus === "running" ? "bg-indigo-600 text-white animate-pulse" : "bg-slate-100 text-slate-500"
                                }`}>
                                {auraStatus === "completed" ? <Check className="w-3 h-3 stroke-[3]" /> : "01"}
                              </div>
                              <div className="min-w-0">
                                <div className="text-[11px] font-bold text-slate-800 flex items-center gap-1 truncate">
                                  Aura Agent
                                  {auraStatus === "running" && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></span>}
                                </div>
                                <p className="text-[9px] text-slate-450 mt-0.5 truncate">Recap & Tasks Extractor</p>
                              </div>
                            </div>

                            {/* Step 2: Chronos */}
                            <div className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all text-left ${chronosStatus === "running" ? "bg-indigo-50/40 border-indigo-300 shadow-xs" :
                              chronosStatus === "completed" ? "bg-emerald-50/25 border-emerald-200 opacity-90" : "bg-white border-slate-200/80"
                              }`}>
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold font-mono shrink-0 ${chronosStatus === "completed" ? "bg-emerald-500 text-white" :
                                chronosStatus === "running" ? "bg-indigo-600 text-white animate-pulse" : "bg-slate-100 text-slate-500"
                                }`}>
                                {chronosStatus === "completed" ? <Check className="w-3 h-3 stroke-[3]" /> : "02"}
                              </div>
                              <div className="min-w-0">
                                <div className="text-[11px] font-bold text-slate-800 flex items-center gap-1 truncate">
                                  Chronos Agent
                                  {chronosStatus === "running" && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></span>}
                                </div>
                                <p className="text-[9px] text-slate-450 mt-0.5 truncate">Overlap Optimizer</p>
                              </div>
                            </div>

                            {/* Step 3: Scribe */}
                            <div className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all text-left ${scribeStatus === "running" ? "bg-indigo-50/40 border-indigo-300 shadow-xs" :
                              scribeStatus === "completed" ? "bg-emerald-50/25 border-emerald-200 opacity-90" : "bg-white border-slate-200/80"
                              }`}>
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold font-mono shrink-0 ${scribeStatus === "completed" ? "bg-emerald-500 text-white" :
                                scribeStatus === "running" ? "bg-indigo-600 text-white animate-pulse" : "bg-slate-100 text-slate-500"
                                }`}>
                                {scribeStatus === "completed" ? <Check className="w-3 h-3 stroke-[3]" /> : "03"}
                              </div>
                              <div className="min-w-0">
                                <div className="text-[11px] font-bold text-slate-800 flex items-center gap-1 truncate">
                                  Scribe Agent
                                  {scribeStatus === "running" && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></span>}
                                </div>
                                <p className="text-[9px] text-slate-450 mt-0.5 truncate">Team Comms Drafter</p>
                              </div>
                            </div>

                            {/* Step 4: SMTP Send */}
                            <div className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all text-left ${smtpStatus === "sending" ? "bg-indigo-50/40 border-indigo-300 shadow-xs" :
                              smtpStatus === "sent" ? "bg-emerald-50/25 border-emerald-200 opacity-90" : "bg-white border-slate-200/80"
                              }`}>
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold font-mono shrink-0 ${smtpStatus === "sent" ? "bg-emerald-500 text-white" :
                                smtpStatus === "sending" ? "bg-indigo-600 text-white animate-pulse" : "bg-slate-100 text-slate-500"
                                }`}>
                                {smtpStatus === "sent" ? <Check className="w-3 h-3 stroke-[3]" /> : "04"}
                              </div>
                              <div className="min-w-0">
                                <div className="text-[11px] font-bold text-slate-800 flex items-center gap-1 truncate">
                                  Send / Schedule
                                  {smtpStatus === "sending" && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></span>}
                                </div>
                                <p className="text-[9px] text-slate-450 mt-0.5 truncate font-medium">Outbound Transmission</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Unified Agent Terminal Console Logs */}
                        {agentLogs.length > 0 && (
                          <div className="bg-slate-900 rounded-xl p-4 font-mono text-indigo-300 text-[11px] space-y-1.5 shadow-inner border border-slate-850 text-left">
                            <div className="flex items-center justify-between border-b border-indigo-950/40 pb-2 mb-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <Terminal className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                                Orchestrator Activity Ledger
                              </span>
                              <span className="text-[9px] text-slate-550">Live Output Stream</span>
                            </div>
                            <div className="space-y-1 max-h-36 overflow-y-auto">
                              {agentLogs.map((log, i) => (
                                <div key={i} className="leading-relaxed whitespace-pre-wrap">{log}</div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Project Manager Slot Decision Desk (Active when Chronos has calculated slots) */}
                        {proposedSlots.length > 0 && (
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 text-left shadow-2xs">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 animate-pulse">
                                  <Bot className="w-4 h-4" />
                                </div>
                                <div>
                                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider font-mono">
                                    Project Manager Slot Decision Desk
                                  </h4>
                                  <p className="text-[11px] text-slate-500">
                                    Chronos has evaluated the Top 3 options. Select your preferred slot to trigger Agent Scribe.
                                  </p>
                                </div>
                              </div>
                              {scribeStatus === "idle" && (
                                <span className="bg-amber-100 border border-amber-200 text-amber-800 text-[9px] font-bold font-mono px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                                  Action Required: Trigger Scribe
                                </span>
                              )}
                            </div>

                            {/* The Interactive Selector Grid (The 3 candidates: Gold, Silver, Bronze) */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {proposedSlots.slice(0, 3).map((slot, index) => {
                                const isSelected = selectedSlotIndex === index;
                                const rankLabel = index === 0 ? "Gold 🥇" : index === 1 ? "Silver 🥈" : "Bronze 🥉";
                                const rankBadge = index === 0 ? "bg-amber-100 text-amber-850 border-amber-200" : index === 1 ? "bg-slate-150 text-slate-800 border-slate-250" : "bg-orange-100 text-orange-850 border-orange-200";

                                return (
                                  <div
                                    key={index}
                                    onClick={() => handleSelectSlot(slot)}
                                    className={`group relative w-full text-left p-3.5 rounded-lg border transition-all flex flex-col justify-between h-full cursor-pointer hover:shadow-2xs ${isSelected
                                      ? "border-indigo-600 bg-indigo-50/20 ring-1 ring-indigo-500"
                                      : "border-slate-200 bg-white hover:border-slate-350"
                                      }`}
                                  >
                                    <div className="space-y-3.5 w-full">
                                      <div className="flex items-center justify-between">
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase font-mono tracking-wider ${rankBadge}`}>
                                          {rankLabel} ({slot.score} PTS)
                                        </span>
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white"
                                          }`}>
                                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                        </div>
                                      </div>

                                      <div>
                                        <div className="text-xs font-bold text-slate-850">
                                          {slot.utcDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                                        </div>
                                        <div className="text-[10px] font-mono text-slate-500 font-bold mt-0.5">
                                          {slot.utcDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} UTC
                                        </div>
                                      </div>

                                      {/* Participant Local Times */}
                                      <div className="text-[10px] text-slate-600 border-t border-slate-100/80 pt-2.5 space-y-1">
                                        <div className="text-[8px] uppercase tracking-wider font-extrabold text-slate-400 font-mono">Participant Local Times</div>
                                        <div className="leading-relaxed text-[10px] font-medium break-words text-slate-700">
                                          {getDeduplicatedRoster(slot.participantTimes || slot.attendeeLocalTimes, currentHostName, currentHostEmail).map((at, i) => {
                                            let tzAbbr = "";
                                            try {
                                              const formatter = new Intl.DateTimeFormat("en-US", {
                                                timeZone: at.timezone,
                                                timeZoneName: "short"
                                              });
                                              const parts = formatter.formatToParts(slot.utcDate);
                                              const tzPart = parts.find(p => p.type === "timeZoneName");
                                              tzAbbr = tzPart ? tzPart.value : at.timezone.split("/").pop()?.replace("_", " ") || "UTC";
                                            } catch (e) {
                                              tzAbbr = at.timezone.split("/").pop()?.replace("_", " ") || "UTC";
                                            }

                                            let timeStr = "";
                                            try {
                                              timeStr = slot.utcDate.toLocaleTimeString("en-US", {
                                                timeZone: at.timezone,
                                                hour: "numeric",
                                                minute: "2-digit",
                                                hour12: true
                                              });
                                            } catch (e) {
                                              timeStr = at.localTimeStr.split(" - ")[1] || "";
                                            }

                                            const effectiveRoster = (slot.attendees && slot.attendees.length > 1) ? slot.attendees : (attendees.length > 1 ? attendees : globalExtractedAttendeesRef.current);
                                            const matchedAtt = effectiveRoster.find(a => a.id === at.attendeeId || a.name.toLowerCase() === at.name.toLowerCase());
                                            const pEmail = matchedAtt?.email || `${at.name.toLowerCase().replace(/\s+/g, ".")}@company.com`;

                                            const isHost = at.isHost || matchedAtt?.isHost || (i === 0);

                                            return (
                                              <div key={pEmail || at.attendeeId || i} className="flex items-center justify-between text-[10px] py-0.5 border-b border-slate-100/40 last:border-0 gap-2">
                                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                  <span className="font-semibold text-slate-700 truncate">{at.name}</span>
                                                  {isHost && (
                                                    <span className="text-[9px] bg-indigo-50 text-indigo-700 font-bold px-1 py-0.2 rounded shrink-0">
                                                      [H]
                                                    </span>
                                                  )}
                                                </div>
                                                <span className="font-mono font-bold text-slate-800 shrink-0 whitespace-nowrap">{timeStr} ({tzAbbr})</span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="mt-3.5 pt-2 border-t border-slate-100/80 w-full flex flex-col gap-2">
                                      <div className="flex justify-between items-center">
                                        <span className={`text-[9px] font-bold uppercase tracking-wider font-mono ${slot.overallRating === "Perfect"
                                          ? "text-emerald-600"
                                          : slot.overallRating === "Good"
                                            ? "text-blue-600"
                                            : "text-amber-600"
                                          }`}>
                                          {slot.overallRatingLabel} Match
                                        </span>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleSelectSlot(slot);
                                        }}
                                        disabled={isAgentAutopilotRunning || scribeStatus === "running"}
                                        className={`w-full mt-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-xs transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5 ${isSelected ? "opacity-100" : "opacity-90 group-hover:opacity-100"
                                          }`}
                                      >
                                        <span>✉️ Generate Email Draft with Selected Slot</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Display string formatting requested in (2): e.g., "Slot 1: 4:00 AM PST (Sarah) | 12:00 PM BST (Mateo) | 4:30 PM IST (Priya)" */}
                            <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1">
                              <div className="text-[9px] uppercase font-bold text-slate-450 tracking-wider font-mono">
                                Active Candidate Format Summary
                              </div>
                              <div className="text-[11px] font-mono font-semibold text-slate-700 bg-slate-50 p-2 rounded border border-slate-150 leading-relaxed select-all">
                                {`Slot ${selectedSlotIndex + 1}: `}
                                {proposedSlots[selectedSlotIndex] && getFormattedSlotTimes(proposedSlots[selectedSlotIndex])}
                              </div>
                            </div>

                            {/* Trigger Agent Scribe Button */}
                            <div className="flex justify-end pt-1">
                              <button
                                onClick={handleTriggerScribeDraft}
                                disabled={isAgentAutopilotRunning || scribeStatus === "running"}
                                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-lg text-xs transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
                              >
                                <Bot className="w-4 h-4 text-indigo-200" />
                                <span>
                                  {scribeStatus === "completed"
                                    ? "Re-Draft Email with Selected Slot"
                                    : `Trigger Agent Scribe to Draft Email (Option #${selectedSlotIndex + 1})`}
                                </span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Three Agents Modular Cards */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                          {/* Agent 1: Aura Card */}
                          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3.5 flex flex-col justify-between shadow-2xs">
                            <div className="space-y-2 text-left">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                                    <Cpu className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-extrabold text-slate-800">Agent Aura</h4>
                                    <span className="text-[9px] text-slate-400 font-mono font-semibold">Distributor & Extractor</span>
                                  </div>
                                </div>
                                <span className={`px-2 py-0.5 text-[8px] font-extrabold font-mono rounded-full ${auraStatus === "completed" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                                  auraStatus === "running" ? "bg-indigo-50 text-indigo-700 border border-indigo-100 animate-pulse" :
                                    "bg-slate-50 text-slate-500 border border-slate-100"
                                  }`}>
                                  {auraStatus.toUpperCase()}
                                </span>
                              </div>

                              <p className="text-[11px] text-slate-500 leading-relaxed">
                                Distills raw dialogue transcripts to extract action items, key milestones, and suggested agendas automatically.
                              </p>

                              <div className="border-t border-slate-100 pt-3 space-y-2 text-left">
                                <div>
                                  <label className="text-[9px] font-extrabold text-slate-450 uppercase font-mono">Output Depth</label>
                                  <select
                                    value={auraTone}
                                    onChange={(e) => setAuraTone(e.target.value as any)}
                                    className="w-full text-[11px] px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden text-slate-700 font-semibold mt-0.5"
                                  >
                                    <option value="standard">Standard Distillation</option>
                                    <option value="detailed">In-depth Exhaustive Summary</option>
                                    <option value="high_priority">High Priority Items Only</option>
                                  </select>
                                </div>

                                <div className="flex items-center justify-between text-[11px] text-slate-650 pt-1">
                                  <span className="font-semibold text-slate-700">Auto-save to Thread</span>
                                  <input
                                    type="checkbox"
                                    checked={auraAutoSave}
                                    onChange={(e) => setAuraAutoSave(e.target.checked)}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2 pt-2">
                              {auraLogs.length > 0 && (
                                <details className="text-[9px] bg-slate-50 border border-slate-150 rounded p-1.5 text-left">
                                  <summary className="font-mono cursor-pointer font-bold text-slate-650">View Aura Logs ({auraLogs.length})</summary>
                                  <div className="font-mono text-slate-450 max-h-24 overflow-y-auto mt-1 space-y-0.5">
                                    {auraLogs.map((lg, i) => <div key={i}>{lg}</div>)}
                                  </div>
                                </details>
                              )}

                              {auraStatus === "completed" && recapData && (
                                <button
                                  onClick={() => {
                                    setActiveTab("recap");
                                  }}
                                  className="w-full bg-slate-55 hover:bg-slate-100 text-slate-700 border border-slate-200 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                                >
                                  <FileCheck className="w-3.5 h-3.5 text-emerald-500" />
                                  Review Recap Output
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Agent 2: Chronos Card */}
                          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3.5 flex flex-col justify-between shadow-2xs">
                            <div className="space-y-2 text-left">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                                    <Clock className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-extrabold text-slate-800">Agent Chronos</h4>
                                    <span className="text-[9px] text-slate-400 font-mono font-semibold">Scheduler Specialist</span>
                                  </div>
                                </div>
                                <span className={`px-2 py-0.5 text-[8px] font-extrabold font-mono rounded-full ${chronosStatus === "completed" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                                  chronosStatus === "running" ? "bg-indigo-50 text-indigo-700 border border-indigo-100 animate-pulse" :
                                    "bg-slate-50 text-slate-500 border border-slate-100"
                                  }`}>
                                  {chronosStatus.toUpperCase()}
                                </span>
                              </div>

                              <p className="text-[11px] text-slate-500 leading-relaxed">
                                Solves timezone overlap compatibility across global teams, scoring the absolute best follow-up slots automatically.
                              </p>

                              <div className="border-t border-slate-100 pt-3 space-y-2 text-left">
                                <div>
                                  <label className="text-[9px] font-extrabold text-slate-450 uppercase font-mono">Overlap Parameters</label>
                                  <select
                                    value={chronosConstraint}
                                    onChange={(e) => setChronosConstraint(e.target.value as any)}
                                    className="w-full text-[11px] px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden text-slate-700 font-semibold mt-0.5"
                                  >
                                    <option value="core_only">Strict 9AM - 5PM Core Only</option>
                                    <option value="core_shoulder">Standard 8AM - 6PM Core/Shoulder</option>
                                    <option value="relaxed">Relaxed 7AM - 7PM Working Hours</option>
                                  </select>
                                </div>

                                <div className="flex items-center justify-between text-[11px] text-slate-650 pt-1">
                                  <span className="font-semibold text-slate-700 font-sans">Generate .ics Instantly</span>
                                  <span className="text-[9px] text-emerald-600 font-mono font-bold">Enabled</span>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2 pt-2">
                              {chronosLogs.length > 0 && (
                                <details className="text-[9px] bg-slate-50 border border-slate-150 rounded p-1.5 text-left">
                                  <summary className="font-mono cursor-pointer font-bold text-slate-655">View Chronos Logs ({chronosLogs.length})</summary>
                                  <div className="font-mono text-slate-450 max-h-24 overflow-y-auto mt-1 space-y-0.5">
                                    {chronosLogs.map((lg, i) => <div key={i}>{lg}</div>)}
                                  </div>
                                </details>
                              )}

                              {chronosStatus === "completed" && chronosBestSlot && (
                                <button
                                  onClick={() => {
                                    setActiveTab("overlap");
                                  }}
                                  className="w-full bg-slate-55 hover:bg-slate-100 text-slate-700 border border-slate-200 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                                >
                                  <Globe className="w-3.5 h-3.5 text-blue-500" />
                                  Inspect Overlap Visuals
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Agent 3: Scribe Card */}
                          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3.5 flex flex-col justify-between shadow-2xs">
                            <div className="space-y-2 text-left">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                                    <Mail className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-extrabold text-slate-800">Agent Scribe</h4>
                                    <span className="text-[9px] text-slate-400 font-mono font-semibold">Comms Specialist</span>
                                  </div>
                                </div>
                                <span className={`px-2 py-0.5 text-[8px] font-extrabold font-mono rounded-full ${scribeStatus === "completed" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                                  scribeStatus === "running" ? "bg-indigo-50 text-indigo-700 border border-indigo-100 animate-pulse" :
                                    "bg-slate-50 text-slate-500 border border-slate-100"
                                  }`}>
                                  {scribeStatus.toUpperCase()}
                                </span>
                              </div>

                              <p className="text-[11px] text-slate-500 leading-relaxed">
                                Synthesizes summaries, task deliverables, and Chronos recommendations to craft reviewable outbound follow-up email drafts.
                              </p>

                              <div className="border-t border-slate-100 pt-3 space-y-2 text-left">
                                <div>
                                  <label className="text-[9px] font-extrabold text-slate-450 uppercase font-mono block mb-1">
                                    Writing Tone
                                  </label>
                                  <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-3xs">
                                    <button
                                      type="button"
                                      onClick={() => setScribeTone("professional")}
                                      className={`text-[10px] font-bold py-1.5 px-1 rounded-lg transition-all cursor-pointer text-center ${scribeTone === "professional"
                                        ? "bg-white text-indigo-700 shadow-xs border border-slate-200/50"
                                        : "text-slate-600 hover:text-slate-900 border border-transparent"
                                        }`}
                                    >
                                      Professional
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setScribeTone("casual")}
                                      className={`text-[10px] font-bold py-1.5 px-1 rounded-lg transition-all cursor-pointer text-center ${scribeTone === "casual"
                                        ? "bg-white text-indigo-700 shadow-xs border border-slate-200/50"
                                        : "text-slate-600 hover:text-slate-900 border border-transparent"
                                        }`}
                                    >
                                      Casual
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setScribeTone("technical")}
                                      className={`text-[10px] font-bold py-1.5 px-1 rounded-lg transition-all cursor-pointer text-center ${scribeTone === "technical"
                                        ? "bg-white text-indigo-700 shadow-xs border border-slate-200/50"
                                        : "text-slate-600 hover:text-slate-900 border border-transparent"
                                        }`}
                                    >
                                      Technical
                                    </button>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between text-[11px] text-slate-650 pt-1">
                                  <span className="font-semibold text-slate-700">Auto-Inject Agenda</span>
                                  <span className="text-[9px] text-indigo-600 font-mono font-bold">Enabled</span>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2 pt-2">
                              {scribeLogs.length > 0 && (
                                <details className="text-[9px] bg-slate-50 border border-slate-150 rounded p-1.5 text-left">
                                  <summary className="font-mono cursor-pointer font-bold text-slate-655">View Scribe Logs ({scribeLogs.length})</summary>
                                  <div className="font-mono text-slate-450 max-h-24 overflow-y-auto mt-1 space-y-0.5">
                                    {scribeLogs.map((lg, i) => <div key={i}>{lg}</div>)}
                                  </div>
                                </details>
                              )}

                              {scribeStatus === "completed" && (
                                <button
                                  onClick={() => {
                                    setActiveTab("email");
                                  }}
                                  className="w-full bg-slate-55 hover:bg-slate-100 text-slate-700 border border-slate-200 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5 text-indigo-500" />
                                  Review & Edit Draft Body
                                </button>
                              )}
                            </div>
                          </div>

                        </div>

                        {/* Action #2 & #3 Automation Console: SEND REVIEW & FOLLOW-UP meetings */}
                        {scribeStatus === "completed" && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-slate-150 pt-5 mt-2">

                            {/* Left: Email review and Send */}
                            <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-150 space-y-3 text-left">
                              <div className="flex items-center gap-1.5">
                                <Mail className="w-4 h-4 text-indigo-600" />
                                <h4 className="text-xs font-extrabold text-slate-800">
                                  Outbound Email SMTP Mailbox Transmission
                                </h4>
                              </div>
                              <p className="text-[11px] text-slate-500 leading-normal">
                                Review your draft email on the <strong>Email Draft</strong> tab, or trigger the Scribe mail sender to transmit the finalized copy to all attendees.
                              </p>

                              <div className="space-y-3">
                                {smtpStatus === "not_sent" && (
                                  <button
                                    onClick={handleSendDirectly}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    Approve & Transmit Outbound Copy Now
                                  </button>
                                )}

                                {smtpStatus === "sending" && (
                                  <div className="w-full bg-slate-100 border border-slate-200 text-slate-600 py-2 rounded-lg text-xs font-bold text-center flex items-center justify-center gap-2">
                                    <Cpu className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                                    Negotiating secure SMTP TLS relays...
                                  </div>
                                )}

                                {smtpStatus === "sent" && (
                                  <div className="w-full bg-emerald-50 border border-emerald-200 text-emerald-800 py-2 rounded-lg text-xs font-bold text-center flex items-center justify-center gap-1.5">
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                    SMTP Relay Complete! Transmission confirmed.
                                  </div>
                                )}

                                {/* Direct Dispatch & Handlers Section */}
                                <div className="border-t border-slate-200/60 pt-3 mt-2 space-y-2">
                                  <div className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider font-mono">
                                    Direct Outbound Dispatch
                                  </div>
                                  <div className="flex flex-col gap-2">
                                    <a
                                      href={mailtoLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={handleOpenEmailClient}
                                      className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 border border-indigo-100 text-xs font-bold py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                                    >
                                      <Mail className="w-3.5 h-3.5 text-indigo-600" />
                                      <span>Send via Native Email Client</span>
                                    </a>

                                    <div className="grid grid-cols-2 gap-2">
                                      <button
                                        onClick={handleCopyMarkdown}
                                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[10px] font-bold py-1.5 px-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                                      >
                                        {copiedMarkdown ? (
                                          <>
                                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                            <span className="text-emerald-700">Copied MD!</span>
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="w-3.5 h-3.5 text-slate-550" />
                                            <span>Copy Markdown</span>
                                          </>
                                        )}
                                      </button>

                                      <button
                                        onClick={handleCopyPlainText}
                                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[10px] font-bold py-1.5 px-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                                      >
                                        {copiedPlainText ? (
                                          <>
                                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                            <span className="text-emerald-700">Copied Text!</span>
                                          </>
                                        ) : (
                                          <>
                                            <FileText className="w-3.5 h-3.5 text-slate-550" />
                                            <span>Copy Plain Text</span>
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {smtpLogs.length > 0 && (
                                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 font-mono text-[9px] text-indigo-300 space-y-1 max-h-32 overflow-y-auto">
                                    <div className="font-bold border-b border-indigo-950/30 pb-1 mb-1 text-slate-400">SMTP Server Transmit logs:</div>
                                    {smtpLogs.map((log, i) => (
                                      <div key={i}>{log}</div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Right: Meeting auto-scheduler and ICS download */}
                            <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-150 space-y-3 text-left">
                              <div className="flex items-center gap-1.5">
                                <CalendarCheck className="w-4 h-4 text-indigo-600" />
                                <h4 className="text-xs font-extrabold text-slate-800">
                                  Calendar Booking & Follow-up Scheduling Ledger
                                </h4>
                              </div>
                              <p className="text-[11px] text-slate-500 leading-normal">
                                Chronos has locked option <strong>#{selectedSlotIndex + 1}</strong> based on overlap optimization rating. Auto-booking generates offline invite links and syncing.
                              </p>

                              {chronosBestSlot && (
                                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 shadow-2xs">
                                  <div className="flex items-center justify-between text-[10px] border-b border-slate-50 pb-1.5">
                                    <span className="font-bold font-mono text-indigo-600">Locked Slot Target:</span>
                                    <span className="font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-mono text-[9px]">{chronosBestSlot.overallRating} Match</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-slate-700">
                                      {chronosBestSlot.utcDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                                    </span>
                                    <span className="font-bold text-slate-800 font-mono">
                                      {chronosBestSlot.utcDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} UTC
                                    </span>
                                  </div>

                                  <div className="pt-1 flex gap-2">
                                    <button
                                      onClick={() => handleDownloadIcs(chronosBestSlot, `follow-up-meeting-${selectedSlotIndex + 1}.ics`)}
                                      className="flex-1 text-center bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-extrabold py-2 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                    >
                                      <Download className="w-3 h-3 text-slate-500" />
                                      Download .ics Invite
                                    </button>

                                    <button
                                      onClick={() => {
                                        alert(`Booking verified! GCal API payload dispatched. Attendees: ${attendees.map(a => a.name).join(", ")}`);
                                      }}
                                      className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 text-[10px] font-extrabold py-2 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                    >
                                      <Check className="w-3.5 h-3.5 text-indigo-600" />
                                      Verify Booking
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                          </div>
                        )}

                      </motion.div>
                    )}

                    {/* TAB 5: RECURRING MEETING THREADS */}
                    {activeTab === "threads" && (
                      !isUserLoggedIn ? (
                        <div className="text-center py-16 bg-slate-50 border border-slate-200 rounded-xl p-8 max-w-md mx-auto space-y-4 my-8">
                          <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center mx-auto text-indigo-600">
                            <Lock className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-slate-800">Recurring Threads Hub Locked</h3>
                            <p className="text-xs text-slate-500 mt-1">
                              A Primary Account is required to create, view, and organize recurring meeting threads and history.
                            </p>
                          </div>
                          <button
                            onClick={() => setIsSetupModalOpen(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                          >
                            Sign In to Access Recurring Threads
                          </button>
                        </div>
                      ) : (
                                /* Recurring Threads Hub Content */
                              )
                    )}
                    Save this session summary into a chronological recurring workspace
                  </p>
                </div>
                            </div>

          {saveSuccessMessage && (
            <div className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5 animate-pulse">
              {saveSuccessMessage}
            </div>
          )}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <select
          value={saveTargetThreadId}
          onChange={(e) => setSaveTargetThreadId(e.target.value)}
          className="text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden text-slate-700 font-medium grow max-w-[200px]"
        >
          <option value="">-- Select Recurring Thread --</option>
          <option value="new">+ Create New Thread...</option>
          {visibleThreads.map((t) => (
            <option key={t.id} value={t.id}>{t.title} ({t.entries.length} saves)</option>
          ))}
        </select>

        {saveTargetThreadId === "new" && (
          <input
            type="text"
            placeholder="E.g., Weekly Marketing Align..."
            value={newThreadTitle}
            onChange={(e) => setNewThreadTitle(e.target.value)}
            className="text-xs px-2.5 py-1.5 bg-white border border-indigo-200 rounded-lg focus:outline-hidden text-slate-700 font-semibold w-full sm:w-auto grow"
          />
        )}

        <button
          onClick={handleSaveToThread}
          disabled={!saveTargetThreadId || (saveTargetThreadId === "new" && !newThreadTitle.trim())}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold px-3.5 py-1.5 rounded-lg text-[10px] transition-colors cursor-pointer flex items-center gap-1 shrink-0 uppercase tracking-wider ml-auto"
        >
          <FolderSync className="w-3.5 h-3.5" />
          Save Recap to Thread
        </button>
      </div>
    </div>
  ) : (
    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl mb-5 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-700">🔒 Recurring Thread Hub</span>
        <span className="text-xs text-slate-500">(Primary Account Required)</span>
      </div>
      <button
        onClick={() => setIsSetupModalOpen(true)}
        className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-700 transition cursor-pointer"
      >
        Sign In to Save History
      </button>
    </div>
  )
                    )
}

{/* TAB 1: RECAP & TASKS */ }
{
  activeTab === "recap" && (
    (!hasProcessed || !recapData) ? (
      <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-slate-100 p-6 space-y-3">
        <HelpCircle className="w-8 h-8 text-indigo-400 mx-auto animate-bounce" />
        <h4 className="text-sm font-bold text-slate-800">No Intelligence Extracted Yet</h4>
        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
          Click <span className="font-bold text-indigo-600">EXTRACT INTELLIGENCE</span> or trigger <span className="font-bold text-indigo-600">AI Autopilot</span> to process this transcript.
        </p>
      </div>
    ) : (
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >

        {/* Header title */}
        <div className="border-b border-slate-100 pb-3">
          <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest font-mono">Suggested Email Subject Line</span>
          <h3 className="text-sm font-bold text-slate-800 mt-0.5">
            {meetingTitle || recapData.suggestedTitle}
          </h3>
        </div>

        {/* Executive Summary Card - Serif Typography */}
        <div className="bg-slate-50/50 rounded-lg p-4 border border-slate-100 font-serif text-slate-700 leading-relaxed text-xs">
          <h4 className="text-[10px] font-sans font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-indigo-500" />
            Executive Summary
          </h4>
          <p className="font-serif">
            {recapData.summary}
          </p>
        </div>

        {/* Key Topics Grid */}
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
            Key Topics Discussed
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {recapData.keyTopics.map((topic, i) => (
              <div key={i} className="flex items-start gap-2 p-2 bg-slate-50/50 border border-slate-100 rounded">
                <span className="text-xs text-indigo-500 font-mono font-bold">•</span>
                <span className="text-xs text-slate-700 font-medium">{topic}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Items Interactive Checklist */}
        <div>
          {isExportDropdownOpen && (
            <div className="fixed inset-0 z-40" onClick={() => setIsExportDropdownOpen(false)} />
          )}
          <div className="flex items-center justify-between mb-2.5 relative">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Action Items Checklist
            </h4>

            {/* Export Dropdown Anchor */}
            <div className="relative z-50">
              <button
                id="export-tasks-btn"
                onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                className="text-[10px] bg-white hover:bg-indigo-50 hover:border-indigo-300 border border-slate-200 text-indigo-700 font-bold px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <FileCheck className="w-3.5 h-3.5 text-indigo-600" />
                Multi-Platform Export
                <ChevronDown className={`w-3 h-3 transition-transform ${isExportDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
                {isExportDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 5, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-1.5 w-52 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-1.5 space-y-0.5"
                  >
                    <div className="text-[9px] uppercase font-mono tracking-widest text-slate-400 font-bold px-2 py-1">
                      Export Formats
                    </div>
                    <button
                      id="export-jira-btn"
                      onClick={() => {
                        handleExportJira();
                        setIsExportDropdownOpen(false);
                      }}
                      className="w-full text-left flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                        Jira / Confluence Markup
                      </span>
                      {copiedFormat === "jira" ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <Copy className="w-3 h-3 text-slate-400 shrink-0" />
                      )}
                    </button>

                    <button
                      id="export-markdown-btn"
                      onClick={() => {
                        handleExportMarkdown();
                        setIsExportDropdownOpen(false);
                      }}
                      className="w-full text-left flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
                        Markdown Checkboxes
                      </span>
                      {copiedFormat === "markdown" ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <Copy className="w-3 h-3 text-slate-400 shrink-0" />
                      )}
                    </button>

                    <button
                      id="export-csv-btn"
                      onClick={() => {
                        handleExportCSV();
                        setIsExportDropdownOpen(false);
                      }}
                      className="w-full text-left flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Asana / Trello (CSV)
                      </span>
                      {copiedFormat === "csv" ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <Download className="w-3 h-3 text-slate-400 shrink-0" />
                      )}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          {recapData.actionItems.length === 0 ? (
            <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-lg text-center">
              No clear action items extracted from discussion.
            </p>
          ) : (
            <div className="space-y-1.5">
              {recapData.actionItems.map((item, index) => (
                <button
                  key={index}
                  onClick={() => toggleActionItem(index)}
                  className={`w-full text-left flex items-start gap-3 p-2.5 rounded-lg border transition-all cursor-pointer ${item.completed
                    ? "bg-emerald-50/20 border-emerald-100 opacity-60 line-through text-slate-500"
                    : "bg-white border-slate-150 hover:border-indigo-200 hover:bg-indigo-50/5"
                    }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {item.completed ? (
                      <div className="bg-emerald-500 text-white p-0.5 rounded">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-3.5 h-3.5 border border-slate-300 rounded bg-white hover:border-indigo-500 transition-colors" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold leading-normal text-slate-800">{item.task}</div>
                    {item.nextSteps && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1.5 text-[10px] text-slate-600 bg-slate-50/80 border border-slate-150/40 rounded-md p-1.5 font-sans leading-relaxed"
                      >
                        <span className="font-mono font-extrabold text-[8px] uppercase text-indigo-600 tracking-wider mr-1">Next Steps:</span>
                        {item.nextSteps}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[9px] font-mono">
                      <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded font-bold">
                        Owner: {item.assignee}
                      </span>
                      {item.deadline && item.deadline !== "Not specified" && (
                        <span className="bg-amber-50 text-amber-700 px-1.5 py-0.2 rounded font-bold">
                          Due: {item.deadline}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Suggested Agenda Card */}
        <div className="border-t border-slate-100 pt-3">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
            Suggested Agenda for Follow-up Sync
          </h4>
          <ol className="space-y-1">
            {recapData.suggestedAgenda.map((agenda, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-slate-600">
                <span className="font-mono text-indigo-600 font-bold bg-indigo-50/60 w-4.5 h-4.5 rounded flex items-center justify-center text-[9px] shrink-0">
                  {i + 1}
                </span>
                <span>{agenda}</span>
              </li>
            ))}
          </ol>
        </div>
      </motion.div>
    )
  )
}

{/* TAB 2: TIMEZONE OVERLAP PLANNER */ }
{
  activeTab === "overlap" && (
    (!proposedSlots || proposedSlots.length === 0) ? (
      <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-slate-100 p-6 space-y-3">
        <HelpCircle className="w-8 h-8 text-indigo-400 mx-auto animate-bounce" />
        <h4 className="text-sm font-bold text-slate-800">No Timezone Overlap Calculated Yet</h4>
        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
          Click <span className="font-bold text-indigo-600">EXTRACT INTELLIGENCE</span> or trigger <span className="font-bold text-indigo-600">AI Autopilot</span> to process this transcript.
        </p>
      </div>
    ) : (
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-indigo-600" />
            Timezone Overlap Solver
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            The scheduler calculated the best 3 slots next week where attendees are awake and free (9:00 AM - 5:00 PM local).
          </p>
        </div>

        <div className="space-y-3">
          {proposedSlots.map((slot, index) => {
            const isSelected = selectedSlotIndex === index;
            return (
              <div
                key={index}
                onClick={() => setSelectedSlotIndex(index)}
                className={`p-4 rounded-lg border transition-all cursor-pointer ${isSelected
                  ? "bg-indigo-50/30 border-indigo-500 ring-1 ring-indigo-500"
                  : "bg-white border-slate-200 hover:border-slate-350"
                  }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <div className={`text-[9px] px-2 py-0.5 rounded font-bold font-mono ${index === 0
                      ? "bg-emerald-100 text-emerald-800"
                      : index === 1
                        ? "bg-blue-100 text-blue-800"
                        : "bg-amber-100 text-amber-800"
                      }`}>
                      OPTION #{index + 1} ({slot.score} PTS)
                    </div>
                    <div className="text-xs font-bold text-slate-800">
                      {slot.utcDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider font-mono ${slot.overallRating === "Perfect"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                      : slot.overallRating === "Good"
                        ? "bg-blue-50 text-blue-700 border-blue-100"
                        : slot.overallRating === "Challenging"
                          ? "bg-amber-50 text-amber-700 border-amber-100"
                          : "bg-red-50 text-red-700 border-red-100"
                      }`}>
                      {slot.overallRatingLabel}
                    </span>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300"
                      }`}>
                      {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                  </div>
                </div>

                {/* Local Time Breakdown and Visual Timeline */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 p-3 rounded border border-slate-100">
                  {/* List with detail */}
                  <div className="space-y-1.5">
                    <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Local Attendee Times</div>
                    <div className="space-y-1">
                      {getDeduplicatedRoster(slot.attendeeLocalTimes, currentHostName, currentHostEmail).map((at) => {
                        const effectiveRoster = (slot.attendees && slot.attendees.length > 1) ? slot.attendees : (attendees.length > 1 ? attendees : globalExtractedAttendeesRef.current);
                        const hostTz = effectiveRoster.find(x => x.isHost)?.timezone;
                        return (
                          <div key={at.attendeeId} className="flex justify-between items-center text-xs">
                            <span className="text-slate-600 font-medium">
                              {at.name} {at.timezone === hostTz && <span className="text-[9px] text-slate-400 font-normal">(Host)</span>}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-slate-800 font-bold">{at.localTimeStr.split(" - ")[1]}</span>
                              <span className={`w-2 h-2 rounded-full ${at.status === "core"
                                ? "bg-emerald-500"
                                : (at.status === "shoulder" || at.status === "off")
                                  ? "bg-amber-500"
                                  : "bg-red-500"
                                }`} title={at.statusLabel}></span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Visual 24h Grid Representation */}
                  <div className="flex flex-col justify-center">
                    <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">Time overlap map</div>
                    <div className="space-y-1">
                      {getDeduplicatedRoster(slot.attendeeLocalTimes, currentHostName, currentHostEmail).map((at) => (
                        <div key={at.attendeeId} className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-500 w-16 truncate text-left">{at.name}</span>
                          <div className="flex-1 flex gap-0.5 bg-slate-100 rounded-sm p-0.5">
                            {/* Represent timeline blocks: morning, work, evening, sleep */}
                            <div className={`h-2 flex-1 rounded-xs ${at.status === "core"
                              ? "bg-emerald-500"
                              : (at.status === "shoulder" || at.status === "off")
                                ? "bg-amber-500"
                                : "bg-red-500"
                              }`}></div>
                          </div>
                          <span className="text-[9px] font-mono text-slate-400 w-14 text-right">
                            {at.localHour}:00 {at.localHour >= 12 ? "PM" : "AM"}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-2 border-t border-slate-100 pt-1">
                      <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Core</span>
                      <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Shoulder</span>
                      <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Sleep</span>
                    </div>
                  </div>
                </div>

                {/* Trigger Button: Generate Email Draft with Selected Slot */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex justify-end">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectSlot(slot);
                    }}
                    disabled={isAgentAutopilotRunning || scribeStatus === "running"}
                    className={`w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-xs transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5 ${isSelected ? "opacity-100" : "opacity-90 group-hover:opacity-100"
                      }`}
                  >
                    <span>✉️ Generate Email Draft with Selected Slot</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    )
  )
}

{/* TAB 3: CALENDAR INVITES (.ICS) */ }
{
  activeTab === "calendar" && (
    (!proposedSlots || proposedSlots.length === 0) ? (
      <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-slate-100 p-6 space-y-3">
        <HelpCircle className="w-8 h-8 text-indigo-400 mx-auto animate-bounce" />
        <h4 className="text-sm font-bold text-slate-800">No Calendar Invites Generated Yet</h4>
        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
          Click <span className="font-bold text-indigo-600">EXTRACT INTELLIGENCE</span> or trigger <span className="font-bold text-indigo-600">AI Autopilot</span> to process this transcript.
        </p>
      </div>
    ) : (
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
            <CalendarCheck className="w-3.5 h-3.5 text-indigo-600" />
            Download .ics Calendar Invites
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Click download to instantly generate standard `.ics` files. Drag them into Google Calendar, Outlook, or Apple Calendar easily!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {proposedSlots.map((slot, index) => {
            const dateStr = slot.utcDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
            const timeStr = slot.utcDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

            return (
              <div
                key={index}
                className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm hover:border-slate-350 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Option #{index + 1}</span>
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${slot.overallRating === "Perfect" ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-700"
                      }`}>
                      {slot.overallRating}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-800">{dateStr}</div>
                  <div className="text-[11px] text-indigo-600 font-mono font-bold mt-1">{timeStr} UTC</div>
                  <div className="text-[10px] text-slate-400 mt-2 border-t border-slate-100 pt-2 space-y-1">
                    <div className="font-bold text-slate-500 uppercase tracking-tight text-[8px]">Attendee Times:</div>
                    {getDeduplicatedRoster(slot.attendeeLocalTimes, currentHostName, currentHostEmail).map((at) => (
                      <div key={at.attendeeId} className="flex justify-between">
                        <span className="truncate max-w-[75px] font-medium text-slate-600">{at.name}</span>
                        <span className="font-mono text-slate-700 font-bold">{at.localTimeStr.split(" - ")[1]}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => handleDownloadIcs(slot, `meeting-follow-up-option-${index + 1}.ics`)}
                  className="w-full text-center mt-3.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold py-1.5 rounded flex items-center justify-center gap-1 transition-colors border border-indigo-100 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  Download .ics File
                </button>
              </div>
            );
          })}
        </div>
      </motion.div>
    )
  )
}

{/* TAB 4: EMAIL RECAP EMAIL DRAFT */ }
{
  activeTab === "email" && (
    (!hasProcessed || !recapData || !editedEmail) ? (
      <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-slate-100 p-6 space-y-3">
        <HelpCircle className="w-8 h-8 text-indigo-400 mx-auto animate-bounce" />
        <h4 className="text-sm font-bold text-slate-800">No Email Draft Generated Yet</h4>
        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
          Click <span className="font-bold text-indigo-600">EXTRACT INTELLIGENCE</span> or trigger <span className="font-bold text-indigo-600">AI Autopilot</span> to process this transcript.
        </p>
      </div>
    ) : (
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        {/* Control bar */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-indigo-600" />
              Email Recap Draft
            </h3>
          </div>

          <div className="flex items-center bg-slate-100 rounded p-0.5 border border-slate-200">
            <button
              onClick={() => setEmailMode("preview")}
              className={`px-3.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded transition-all cursor-pointer flex items-center gap-1 ${emailMode === "preview" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
            >
              <span>👁️ Preview</span>
            </button>
            <button
              onClick={() => setEmailMode("edit")}
              className={`px-3.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded transition-all cursor-pointer flex items-center gap-1 ${emailMode === "edit" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
            >
              <span>✏️ Edit Draft</span>
            </button>
          </div>
        </div>

        {/* Email Connection Required Alert Banner */}
        {gmailConnectionWarning && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 text-[11px] text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs text-left animate-fade-in">
            <div className="flex items-start gap-2.5 flex-1">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-extrabold text-amber-950 block">No Outbox Connected</span>
                <span className="text-amber-850 leading-normal block">{gmailConnectionWarning}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto">
              <button
                type="button"
                onClick={handleCopyPlainText}
                className="text-[10px] bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-lg shadow-2xs cursor-pointer transition-colors flex items-center gap-1.5 justify-center flex-1 sm:flex-initial"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Draft Content</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const card = document.getElementById("email-account-connect-card") || document.getElementById("google-account-connect-card");
                  if (card) {
                    card.scrollIntoView({ behavior: "smooth", block: "center" });
                    card.classList.add("ring-2", "ring-indigo-500");
                    setTimeout(() => {
                      card.classList.remove("ring-2", "ring-indigo-500");
                    }, 2500);
                  }
                }}
                className="text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg shadow-2xs cursor-pointer transition-colors flex items-center gap-1 justify-center flex-1 sm:flex-initial"
              >
                <span>Connect Account</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Server Connection Error Alert Banner with Fallback Copy Button */}
        {serverConnectionError && (
          <div className="bg-rose-50 border border-rose-300 rounded-xl p-3.5 text-[11px] text-rose-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs text-left animate-fade-in">
            <div className="flex items-start gap-2.5 flex-1">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-extrabold text-rose-950 block">Server Connection Error</span>
                <span className="text-rose-850 leading-normal block">{serverConnectionError}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyPlainText}
              className="text-[10px] bg-rose-600 hover:bg-rose-700 text-white font-bold px-3 py-1.5 rounded-lg shrink-0 shadow-2xs cursor-pointer transition-colors flex items-center gap-1.5 self-stretch sm:self-auto justify-center"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Email to Clipboard</span>
            </button>
          </div>
        )}

        {/* Universal Email & Google Connection Manager Component */}
        <EmailConnectionManager
          isAuthenticated={isAuthenticated}
          isGuestMode={isGuestMode}
          user={{ name: currentHostName, email: currentUserEmail }}
          currentUserEmail={currentUserEmail}
          isEmailConnected={isEmailConnected}
          isGoogleConnected={isGoogleConnected}
          driveUser={driveUser}
          emailConnectionType={emailConnectionType}
          setEmailConnectionType={setEmailConnectionType}
          smtpConfig={smtpConfig}
          setSmtpConfig={setSmtpConfig}
          smtpConfigSaved={smtpConfigSaved}
          setSmtpConfigSaved={setSmtpConfigSaved}
          smtpSaveSuccessMessage={smtpSaveSuccessMessage}
          setSmtpSaveSuccessMessage={setSmtpSaveSuccessMessage}
          googleSignIn={googleSignIn}
          googleSignOut={googleSignOut}
          setDriveUser={setDriveUser}
          setDriveAccessToken={setDriveAccessToken}
          setDriveFiles={setDriveFiles}
          setSmtpStatus={setSmtpStatus}
          setSmtpLogs={setSmtpLogs}
          setGmailConnectionWarning={setGmailConnectionWarning}
          setPreLoginWarning={setPreLoginWarning}
          setError={setError}
          setAgentLogs={setAgentLogs}
          onOpenPrivacy={() => setActiveLegalModal("privacy")}
          onOpenTerms={() => setActiveLegalModal("terms")}
          onOpenLoginModal={() => {
            setSetupName("");
            setSetupEmail("");
            setSetupPassword("");
            setAuthModalMode("login");
            setSetupError(null);
            setIsSetupModalOpen(true);
          }}
        />

        {/* Subject Line Input Block */}
        <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 space-y-2 text-left">
          <label className="text-[10px] uppercase font-bold text-slate-550 block flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-slate-600 font-bold">Subject Line</span>
          </label>
          <input
            type="text"
            value={emailSubject}
            onChange={(e) => {
              setEmailSubject(e.target.value);
              setHasUserEditedSubject(true);
            }}
            placeholder="Enter email subject line..."
            className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500 font-semibold text-slate-800 shadow-2xs"
          />
        </div>

        {/* Recipients Manager Block */}
        <div id="email-recipients-box" className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 space-y-3 text-left transition-all">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase font-bold text-slate-550 block flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-slate-600 font-bold">Email Recipients (To:)</span>
            </label>
            <span className="text-[9px] font-mono text-slate-450 font-bold">
              {recipients.length} Recipient{recipients.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Recipient Validation Alert Banner */}
          {!currentRecipientsValidation.isValid && currentRecipientsValidation.reason && (
            <div className="bg-rose-50 border border-rose-300 rounded-lg p-2.5 text-[11px] text-rose-950 flex items-center gap-2 shadow-2xs animate-fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-extrabold text-rose-900 leading-snug">
                Invalid recipient address detected. Please update before sending.
              </span>
            </div>
          )}

          {/* Recipient Badges */}
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 bg-white border border-slate-150 rounded-lg min-h-[38px]">
            {recipients.length === 0 ? (
              <span className="text-[10px] text-slate-400 italic p-1">No recipients specified. Enter an email below to add.</span>
            ) : (
              recipients.map((email, i) => {
                const singleVal = validateRecipientEmail(email);
                const isErr = !singleVal.isValid;
                return (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1 text-[10px] rounded-full px-2.5 py-0.5 font-semibold transition-all ${isErr
                      ? "bg-rose-100 text-rose-900 border border-rose-300 ring-1 ring-rose-300/40"
                      : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                      }`}
                    title={isErr ? singleVal.message : undefined}
                  >
                    {isErr && <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />}
                    <span>{email}</span>
                    {isErr && (
                      <span className="text-[8.5px] uppercase tracking-wider font-extrabold text-rose-700 font-mono">
                        (Invalid)
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setRecipients(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-slate-400 hover:text-slate-700 font-bold text-[10px] pl-0.5 cursor-pointer ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                );
              })
            )}
          </div>

          {/* Add recipient form */}
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="Add recipient email address..."
              value={newRecipientInput}
              onChange={(e) => setNewRecipientInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (newRecipientInput.trim() && !recipients.includes(newRecipientInput.trim())) {
                    setRecipients(prev => [...prev, newRecipientInput.trim()]);
                    setNewRecipientInput("");
                  }
                }
              }}
              className="flex-1 text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500 font-medium"
            />
            <button
              type="button"
              onClick={() => {
                if (newRecipientInput.trim() && !recipients.includes(newRecipientInput.trim())) {
                  setRecipients(prev => [...prev, newRecipientInput.trim()]);
                  setNewRecipientInput("");
                }
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        </div>

        {/* Main Workspace Render */}
        {emailMode === "edit" ? (
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
              <span className="flex items-center gap-1.5 font-medium">
                <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>You are editing the Markdown draft directly.</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEmailMode("preview")}
                  className="text-[10px] bg-white hover:bg-slate-50 border border-slate-200 font-bold px-2.5 py-1 rounded-lg text-slate-700 transition-colors flex items-center gap-1 shadow-3xs cursor-pointer"
                >
                  <Eye className="w-3 h-3 text-indigo-600" />
                  Preview Formatted
                </button>
                <button
                  type="button"
                  onClick={handleResetDraft}
                  className="text-[10px] bg-white hover:bg-slate-50 border border-slate-200 font-bold px-2.5 py-1 rounded-lg text-indigo-600 transition-colors flex items-center gap-1 shadow-3xs cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset Draft
                </button>
              </div>
            </div>
            <textarea
              value={editedEmail}
              onChange={(e) => {
                setEditedEmail(e.target.value);
                setHasUserEdited(true);
              }}
              rows={15}
              className="w-full p-4 text-xs font-mono border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 resize-y bg-white shadow-inner"
              placeholder="Type or edit meeting recap email body here..."
            />
          </div>
        ) : (
          <div className="relative group">
            <div className="prose prose-slate max-w-none text-xs border border-slate-200 rounded-xl p-5 bg-white max-h-[440px] overflow-y-auto leading-relaxed font-serif text-slate-800 shadow-2xs">
              <Markdown>{editedEmail}</Markdown>
            </div>
            <button
              type="button"
              onClick={() => setEmailMode("edit")}
              className="absolute top-3 right-3 opacity-90 group-hover:opacity-100 transition-opacity bg-white hover:bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 shadow-md flex items-center gap-1 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Edit Draft Content</span>
            </button>
          </div>
        )}

        {/* Sticky Footer Action Bar */}
        <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 mt-2">
          {isMailtoTooLong && (
            <div className="flex flex-row items-center justify-between gap-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 font-bold shadow-2xs w-full">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="truncate">
                  ⚠️ Draft exceeds 2,000 chars (Too long for desktop mailto link).
                </span>
              </div>
              <button
                type="button"
                onClick={handleAutoShortenDraft}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-2xs text-[10px] uppercase tracking-wider flex items-center gap-1 shrink-0"
              >
                ⚡ Auto-Shorten Draft
              </button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-[10px] text-slate-450 flex items-center gap-1.5 font-mono">
              <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>
                Selected follow-up Option <strong>#{selectedSlotIndex + 1}</strong> is pre-populated.
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={handleCopyMarkdown}
                className="flex-1 sm:flex-initial bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                {copiedMarkdown ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-700">Copied Markdown!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Raw Markdown</span>
                  </>
                )}
              </button>

              <button
                id="copy-draft-content-btn"
                onClick={handleCopyPlainText}
                className="flex-1 sm:flex-initial bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 px-3.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                {copiedPlainText ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-700">Copied Draft Content!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Copy Draft Content</span>
                  </>
                )}
              </button>

              {isMailtoTooLong ? (
                <button
                  id="send-draft-email-client-btn"
                  disabled
                  className="flex-1 sm:flex-initial bg-slate-100 border border-slate-200 text-slate-400 px-3.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-not-allowed opacity-60"
                  title="Mailto link disabled because draft exceeds 2,000 char desktop limit. Use 'Send Directly from App' or 'Copy Draft Content'."
                >
                  <Mail className="w-3.5 h-3.5 text-slate-350" />
                  <span>Open in Email Client</span>
                </button>
              ) : (
                <a
                  id="send-draft-email-client-btn"
                  href={mailtoLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleOpenEmailClient}
                  className="flex-1 sm:flex-initial bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <Mail className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Open in Email Client</span>
                </a>
              )}

              <button
                id="send-draft-email-direct-btn"
                onClick={handleSendDirectly}
                disabled={smtpStatus === "sending" || recipients.length === 0}
                title={!isEmailConnected ? "No Outbox Connected. Connect an account above or copy draft content." : ""}
                className={`flex-1 sm:flex-initial text-white px-3.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-indigo-100 ${smtpStatus === "sending" ? "bg-indigo-600 opacity-60 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
                  }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>{smtpStatus === "sending" ? "Sending..." : "Send Directly from App"}</span>
              </button>

              <button
                id="finish-and-clear-session-btn"
                onClick={handleFinishAndClear}
                className="flex-1 sm:flex-initial bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 px-3.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                title="Wipe workspace session memory and return to main workflow view for a new meeting"
              >
                <CheckCheck className="w-3.5 h-3.5 text-rose-600" />
                <span>Finish & Clear Session</span>
              </button>
            </div>
          </div>
        </div>

        {/* Email Connection Required Alert Banner */}
        {(!isGoogleConnected && !isSmtpConnected) && (
          <div className="bg-amber-50/90 border border-amber-200/90 rounded-xl p-3.5 text-[11px] text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs text-left animate-fade-in">
            <div className="flex items-start gap-2.5 flex-1">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-extrabold text-amber-950 block text-[11.5px]">No Outbox Connected</span>
                <span className="text-amber-850 leading-normal block">
                  Please connect an email account above to dispatch directly from the app, or use the 'Copy Draft Content' button to paste this email into your preferred email provider.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto">
              <button
                type="button"
                onClick={handleCopyPlainText}
                className="text-[10px] bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-lg shadow-2xs cursor-pointer transition-colors flex items-center gap-1.5 justify-center flex-1 sm:flex-initial"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Draft Content</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const card = document.getElementById("email-account-connect-card") || document.getElementById("google-account-connect-card");
                  if (card) {
                    card.scrollIntoView({ behavior: "smooth", block: "center" });
                    card.classList.add("ring-2", "ring-indigo-500");
                    setTimeout(() => {
                      card.classList.remove("ring-2", "ring-indigo-500");
                    }, 2500);
                  }
                }}
                className="text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg shadow-2xs cursor-pointer transition-colors flex items-center gap-1 justify-center flex-1 sm:flex-initial"
              >
                <span>Connect Account</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* SMTP Transmission Logs & Inline Status */}
        {(smtpStatus === "sending" || smtpStatus === "sent" || smtpStatus === "error") && (
          <div className="bg-slate-900 border border-slate-800 text-slate-100 p-4 rounded-xl space-y-2.5 text-left font-mono text-[10px] mt-4 shadow-inner">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="font-bold flex items-center gap-1.5 text-indigo-400">
                <Cpu className={`w-3.5 h-3.5 ${smtpStatus === "sending" ? "animate-spin" : ""}`} />
                <span>SMTP Live Pipeline</span>
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide ${smtpStatus === "sending" ? "bg-amber-500/15 text-amber-400" :
                smtpStatus === "error" ? "bg-rose-500/20 text-rose-400 font-extrabold border border-rose-500/30" :
                  "bg-emerald-500/15 text-emerald-400"
                }`}>
                {smtpStatus === "sending" ? "TRANSMITTING..." :
                  smtpStatus === "error" ? "TRANSMISSION FAILED" :
                    "SUCCESSFULLY DELIVERED"}
              </span>
            </div>
            <div className="max-h-36 overflow-y-auto space-y-1">
              {smtpLogs.map((log, index) => (
                <div key={index} className={`leading-relaxed whitespace-pre-wrap ${log.includes('FAILED') || log.includes('❌') ? 'text-rose-400 font-semibold' : ''}`}>
                  {log}
                </div>
              ))}
            </div>
            {smtpStatus === "error" && (
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                <span className="text-[9.5px] text-slate-400">Dispatch error. Use fallback option:</span>
                <button
                  type="button"
                  onClick={handleCopyPlainText}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-sans font-bold px-2.5 py-1 rounded text-[10px] flex items-center gap-1 cursor-pointer transition-colors shadow-xs shrink-0"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy Email to Clipboard</span>
                </button>
              </div>
            )}
          </div>
        )}
      </motion.div>
    )
  )
}

{/* TAB 5: RECURRING MEETING THREADS */ }
{
  activeTab === "threads" && (
    !isUserLoggedIn ? (
      <div className="text-center py-16 bg-slate-50 border border-slate-200 rounded-xl p-8 max-w-md mx-auto space-y-4 my-8">
        <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center mx-auto text-indigo-600">
          <Lock className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-800">Recurring Threads Hub Locked</h3>
          <p className="text-xs text-slate-500 mt-1">
            A Primary Account is required to create, view, and organize recurring meeting threads and history.
          </p>
        </div>
        <button
          onClick={() => setIsSetupModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
        >
          Sign In to Access Recurring Threads
        </button>
      </div>
    ) : (
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-5"
      >
        <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" />
              Recurring Meeting Threads Hub
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Consolidate and search past summaries, rolling action items, and schedules for recurring series.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Threads List Sidebar */}
          <div className="lg:col-span-4 bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 space-y-4">
            <div className="space-y-2">
              <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 block">
                New Recurring Thread
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Weekly Sync, Standup..."
                  value={createThreadNameInput}
                  onChange={(e) => setCreateThreadNameInput(e.target.value)}
                  className="flex-1 text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden"
                />
                <button
                  onClick={() => handleCreateThreadInHub(createThreadNameInput)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2.5 py-1.5 rounded-lg text-xs cursor-pointer flex items-center justify-center transition-colors shadow-xs"
                  title="Create Thread"
                >
                  <FolderPlus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 block">
                Active Threads ({visibleThreads.length})
              </label>

              {visibleThreads.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs font-mono">
                  No authorized threads visible. Use the input above to create one.
                </div>
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {visibleThreads.map((t) => {
                    const isActive = t.id === activeThreadId;
                    return (
                      <div
                        key={t.id}
                        onClick={() => setActiveThreadId(t.id)}
                        className={`p-3 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between gap-2 ${isActive
                          ? "bg-white border-indigo-500 shadow-xs ring-1 ring-indigo-50"
                          : "bg-white/60 border-slate-200 hover:border-slate-300"
                          }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-800 truncate">{t.title}</div>
                          <div className="text-[9px] text-slate-450 font-mono mt-0.5 flex items-center gap-1.5">
                            <span>{t.entries.length} session{t.entries.length !== 1 ? "s" : ""}</span>
                            <span>•</span>
                            <span>Created {t.createdAt}</span>
                          </div>
                        </div>
                        {!t.ownerEmail || t.ownerEmail === currentUserEmail ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteThread(t.id);
                            }}
                            className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-all cursor-pointer shrink-0"
                            title="Delete Thread"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-slate-300 p-1.5 shrink-0" title="Only the owner can delete this thread">
                            <Lock className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Thread Detail Workspace */}
          <div className="lg:col-span-8 space-y-4">
            {(() => {
              const activeThread = visibleThreads.find(t => t.id === activeThreadId);
              if (!activeThread) {
                return (
                  <div className="text-center py-20 bg-slate-50/35 rounded-xl border border-slate-150 flex flex-col items-center justify-center">
                    <History className="w-10 h-10 text-slate-300 mb-2.5 animate-pulse" />
                    <p className="text-xs text-slate-500 font-medium">Select or create a recurring meeting thread to view details.</p>
                  </div>
                );
              }

              // Calculate aggregate rolling tasks
              const allTasks = activeThread.entries.flatMap(e =>
                e.actionItems.map((item, idx) => ({
                  ...item,
                  entryId: e.id,
                  entryTitle: e.meetingTitle || e.recapTitle,
                  entryDate: e.dateStr,
                  originalIndex: idx
                }))
              );
              const completedCount = allTasks.filter(t => t.completed).length;
              const totalCount = allTasks.length;
              const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

              return (
                <div className="space-y-4">
                  {/* Thread Header */}
                  <div className="bg-slate-900 text-white rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-[8px] uppercase tracking-widest font-bold text-indigo-400 font-mono">Recurring Meeting Thread Workspace</div>
                      <h4 className="text-xs font-bold mt-0.5">{activeThread.title}</h4>
                      <div className="text-[10px] text-slate-300 mt-1 flex flex-wrap items-center gap-2">
                        <span>{activeThread.entries.length} logged sessions</span>
                        <span>•</span>
                        <span>{completedCount}/{totalCount} tasks completed ({completionRate}%)</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                      <div className="flex items-center bg-slate-800 rounded p-0.5 border border-slate-700 w-full sm:w-auto justify-center">
                        <button
                          onClick={() => {
                            setThreadSubTab("timeline");
                          }}
                          className={`flex-1 sm:flex-initial px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all cursor-pointer ${threadSubTab === "timeline" ? "bg-white text-slate-900 shadow-xs" : "text-slate-400 hover:text-white"
                            }`}
                        >
                          Session Timeline
                        </button>
                        <button
                          onClick={() => {
                            setThreadSubTab("tasks");
                          }}
                          className={`flex-1 sm:flex-initial px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all cursor-pointer ${threadSubTab === "tasks" ? "bg-white text-slate-900 shadow-xs" : "text-slate-400 hover:text-white"
                            }`}
                        >
                          Rolling Tasks
                        </button>
                      </div>

                      {activeThread.ownerEmail === currentUserEmail && (
                        <button
                          onClick={() => handleDeleteThread(activeThread.id)}
                          className="text-red-400 hover:text-white hover:bg-red-600/90 border border-red-500/30 px-3 py-1.5 rounded-md transition-all cursor-pointer text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 w-full sm:w-auto"
                          title="Delete Entire Recurring Thread"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete Thread
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Thread Access & Member Management */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-150/80 pb-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                        <div>
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Thread Access Control</h4>
                          <p className="text-[9px] text-slate-500">Only authorized members can view or manage this recurring thread.</p>
                        </div>
                      </div>
                      <div className="text-[9px] font-bold font-mono px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-md shrink-0">
                        {activeThread.ownerEmail === currentUserEmail ? "👑 Owner Privilege" : "👁️ Read/Write Access"}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Members List */}
                      <div className="space-y-2">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-450 block">Current Members</span>
                        <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                          {/* Owner */}
                          <div className="flex items-center justify-between bg-white border border-slate-150 p-2 rounded-lg text-xs shadow-2xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-[9px] shrink-0">
                                {userProfiles.find(p => p.email === activeThread.ownerEmail)?.avatar || "👤"}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-slate-700 truncate">
                                  {userProfiles.find(p => p.email === activeThread.ownerEmail)?.name || activeThread.ownerEmail}
                                </p>
                                <p className="text-[9px] text-slate-400 truncate">{activeThread.ownerEmail}</p>
                              </div>
                            </div>
                            <span className="text-[8px] font-bold uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-mono shrink-0">Owner</span>
                          </div>

                          {/* Allowed members */}
                          {(!activeThread.allowedEmails || activeThread.allowedEmails.length === 0) ? (
                            <div className="text-[10px] text-slate-400 italic py-1 pl-1">No other members added to this thread.</div>
                          ) : (
                            activeThread.allowedEmails.map((email) => {
                              const profile = userProfiles.find(p => p.email === email);
                              return (
                                <div key={email} className="flex items-center justify-between bg-white border border-slate-150 p-2 rounded-lg text-xs shadow-2xs">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center font-bold text-[9px] shrink-0">
                                      {profile?.avatar || "👤"}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-bold text-slate-700 truncate">{profile?.name || email}</p>
                                      <p className="text-[9px] text-slate-450 truncate">{email}</p>
                                    </div>
                                  </div>
                                  {activeThread.ownerEmail === currentUserEmail ? (
                                    <button
                                      onClick={() => handleRemoveMemberFromThread(activeThread.id, email)}
                                      className="text-red-500 hover:bg-red-50 hover:text-red-700 px-2 py-1 rounded-md transition-colors font-bold text-[10px] cursor-pointer"
                                      title="Remove Access"
                                    >
                                      Remove
                                    </button>
                                  ) : (
                                    <span className="text-[8px] font-bold uppercase tracking-wide bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded font-mono shrink-0">Member</span>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Add Member Form (Only visible to owner) */}
                      <div className="space-y-2">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-450 block">Grant Thread Access</span>
                        {activeThread.ownerEmail === currentUserEmail ? (
                          <div className="space-y-2 bg-white border border-slate-150 p-2.5 rounded-lg shadow-2xs">
                            <p className="text-[10px] text-slate-500">Authorize another colleague to view this rolling thread and log meetings.</p>
                            <div className="flex gap-2">
                              <select
                                id="add-member-select"
                                className="flex-1 text-[11px] px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden text-slate-700 font-semibold cursor-pointer"
                                defaultValue=""
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val) {
                                    handleAddMemberToThread(activeThread.id, val);
                                    e.target.value = ""; // Reset
                                  }
                                }}
                              >
                                <option value="" disabled>-- Select colleague to add --</option>
                                {userProfiles.filter(p => p.email !== activeThread.ownerEmail && !activeThread.allowedEmails?.includes(p.email))
                                  .map((p, idx) => (
                                    <option key={`${p.email}-${idx}`} value={p.email}>{p.name} ({p.email})</option>
                                  ))
                                }
                              </select>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-slate-100 border border-dashed border-slate-200 p-3 rounded-lg text-center flex flex-col items-center justify-center h-[90px]">
                            <Lock className="w-4 h-4 text-slate-400 mb-1" />
                            <p className="text-[10px] text-slate-500 font-medium">Only the thread owner can grant access to others.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Thread SubTab Timeline */}
                  {threadSubTab === "timeline" && (
                    <div className="space-y-3">
                      {activeThread.entries.length === 0 ? (
                        <div className="text-center py-12 bg-slate-50/50 rounded-lg border border-slate-200">
                          <History className="w-8 h-8 text-slate-400 mx-auto mb-2 animate-pulse" />
                          <p className="text-xs text-slate-500 font-medium">This thread is currently empty.</p>
                          <p className="text-[10px] text-slate-450 mt-1">Generate a meeting recap and click "Save Recap to Thread" above to log a session.</p>
                        </div>
                      ) : (
                        <div className="relative border-l border-indigo-100 ml-3 pl-4 space-y-4 pt-1">
                          {activeThread.entries.map((entry) => {
                            const isExpanded = expandedEntryIds[entry.id] ?? true;
                            return (
                              <div key={entry.id} className="relative group">
                                {/* Timeline Node dot */}
                                <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-white group-hover:bg-indigo-600 transition-colors"></span>

                                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs hover:shadow-xs transition-all">
                                  {/* Header Bar */}
                                  <div
                                    onClick={() => setExpandedEntryIds(prev => ({ ...prev, [entry.id]: !isExpanded }))}
                                    className="bg-slate-50/60 hover:bg-slate-50 px-3.5 py-2.5 flex items-center justify-between gap-3 cursor-pointer select-none"
                                  >
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-[9px] font-bold font-mono text-indigo-600 px-1.5 py-0.2 bg-indigo-50 rounded">
                                          {entry.dateStr}
                                        </span>
                                        {entry.selectedSlot && (
                                          <span className="text-[8px] font-bold text-slate-500 bg-slate-100 px-1 rounded flex items-center gap-0.5 truncate max-w-[150px]" title={`Follow-up Scheduled: ${entry.selectedSlot.dateStr} at ${entry.selectedSlot.timeStr}`}>
                                            <Clock className="w-2.5 h-2.5 shrink-0" />
                                            {entry.selectedSlot.timeStr}
                                          </span>
                                        )}
                                      </div>
                                      <h5 className="text-[11px] font-bold text-slate-800 mt-1 truncate">{entry.meetingTitle}</h5>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteEntry(activeThread.id, entry.id);
                                        }}
                                        className="text-slate-300 hover:text-red-500 p-1 rounded transition-colors cursor-pointer"
                                        title="Delete Entry"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                      <ChevronDown className={`w-4 h-4 text-slate-450 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                    </div>
                                  </div>

                                  {/* Content Body */}
                                  {isExpanded && (
                                    <div className="p-4 space-y-3.5 border-t border-slate-100 text-xs">
                                      {/* Summary */}
                                      <div className="space-y-1">
                                        <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Executive Summary</div>
                                        <p className="text-slate-600 font-serif leading-relaxed text-[11px]">{entry.summary}</p>
                                      </div>

                                      {/* Topics & Agenda */}
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-50">
                                        <div>
                                          <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Key Topics Discussed</div>
                                          <div className="flex flex-wrap gap-1">
                                            {entry.keyTopics.map((topic, i) => (
                                              <span key={i} className="text-[9px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-semibold font-sans">
                                                {topic}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                        <div>
                                          <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Proposed Agenda</div>
                                          <ul className="list-decimal list-inside text-slate-600 text-[10px] space-y-0.5 font-medium">
                                            {entry.suggestedAgenda.map((agenda, i) => (
                                              <li key={i} className="truncate">{agenda}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      </div>

                                      {/* Entry Specific Tasks */}
                                      <div className="pt-2.5 border-t border-slate-50 space-y-1.5">
                                        <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Action Items</div>
                                        {entry.actionItems.length === 0 ? (
                                          <div className="text-[10px] text-slate-400 italic">No action items found for this session.</div>
                                        ) : (
                                          <div className="space-y-1.5">
                                            {entry.actionItems.map((item, idx) => (
                                              <div
                                                key={idx}
                                                className={`flex items-start gap-2 p-1.5 rounded transition-colors ${item.completed ? "bg-slate-50/40 opacity-70" : "bg-white"
                                                  }`}
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={item.completed ?? false}
                                                  onChange={() => toggleThreadEntryActionItem(activeThread.id, entry.id, idx)}
                                                  className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                />
                                                <div className="min-w-0 flex-1 leading-normal">
                                                  <span className={`text-[11px] font-semibold text-slate-700 ${item.completed ? "line-through text-slate-400" : ""}`}>
                                                    {item.task}
                                                  </span>
                                                  {item.nextSteps && (
                                                    <div className="mt-1 text-[10px] text-slate-500 bg-slate-50 border border-slate-100/60 rounded-md p-1 leading-relaxed">
                                                      <span className="font-mono font-extrabold text-[8px] uppercase text-indigo-500 tracking-wider mr-1">Next Steps:</span>
                                                      {item.nextSteps}
                                                    </div>
                                                  )}
                                                  <div className="flex items-center gap-1.5 text-[9px] text-slate-400 mt-0.5 font-mono">
                                                    <span className="font-bold text-slate-500 bg-slate-100 px-1 rounded">{item.assignee}</span>
                                                    {item.deadline && (
                                                      <span>• Due: {item.deadline}</span>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Thread SubTab Rolling Tasks */}
                  {threadSubTab === "tasks" && (
                    <div className="space-y-3">
                      {/* Completion Meter */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Thread Task Progress</span>
                          <span className="text-xs font-mono font-bold text-indigo-600">{completedCount} / {totalCount} ({completionRate}%)</span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${completionRate}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Action items list */}
                      {allTasks.length === 0 ? (
                        <div className="text-center py-10 bg-slate-50/50 rounded-lg border border-slate-200 text-xs text-slate-400 italic">
                          No rolling tasks found in any of the logged sessions yet.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {allTasks.map((task, i) => (
                            <div
                              key={i}
                              className={`bg-white border border-slate-200 rounded-lg p-3 flex items-start gap-2.5 shadow-2xs hover:border-slate-300 transition-colors ${task.completed ? "bg-slate-50/40 opacity-70" : ""
                                }`}
                            >
                              <input
                                type="checkbox"
                                checked={task.completed ?? false}
                                onChange={() => toggleThreadEntryActionItem(activeThread.id, task.entryId, task.originalIndex)}
                                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                              />
                              <div className="min-w-0 flex-1 leading-normal">
                                <span className={`text-xs font-bold text-slate-800 ${task.completed ? "line-through text-slate-400" : ""}`}>
                                  {task.task}
                                </span>
                                {task.nextSteps && (
                                  <div className="mt-1 text-[10px] text-slate-500 bg-slate-50 border border-slate-100/60 rounded-md p-1 leading-relaxed">
                                    <span className="font-mono font-extrabold text-[8px] uppercase text-indigo-500 tracking-wider mr-1">Next Steps:</span>
                                    {task.nextSteps}
                                  </div>
                                )}
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-450 mt-1 font-mono">
                                  <span className="font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded">{task.assignee}</span>
                                  {task.deadline && (
                                    <span className="flex items-center gap-0.5 text-slate-500">📅 Due {task.deadline}</span>
                                  )}
                                  <span className="text-slate-300">•</span>
                                  <span className="text-slate-500 truncate max-w-[180px]" title={task.entryTitle}>
                                    From: {task.entryDate} - {task.entryTitle}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </motion.div>
    )
  )
}

                  </div >
                </div >
              )}

            </section >

          </div >
        </main >

  {/* Global Workspace Page Footer */ }
  < footer className = "border-t border-slate-200 bg-white py-6 pb-20 sm:pb-16 mt-16 text-center text-[11px] text-slate-500 font-mono" >
    <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-center">
      <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-slate-500 text-xs font-sans">
        <span className="font-semibold text-slate-700">© 2026 Cadence Desk</span>
        <span className="hidden sm:inline text-slate-300">•</span>
        <span className="text-slate-500 text-[11px] font-mono uppercase tracking-wider">
          Zero-Cloud Intelligent Meeting Workspace
        </span>
      </div>
      <span className="hidden sm:inline text-slate-300">•</span>
      <div className="flex items-center justify-center gap-4 text-slate-600 font-sans text-xs font-medium shrink-0">
        <button
          type="button"
          onClick={() => setActiveLegalModal("privacy")}
          className="hover:text-indigo-600 transition-colors cursor-pointer underline underline-offset-2"
        >
          Privacy Policy
        </button>
        <span className="text-slate-300">•</span>
        <button
          type="button"
          onClick={() => setActiveLegalModal("terms")}
          className="hover:text-indigo-600 transition-colors cursor-pointer underline underline-offset-2"
        >
          Terms of Service
        </button>
      </div>
    </div>
        </footer >

  {/* Google Drive Document Browser Modal */ }
  <AnimatePresence>
{
  isDriveModalOpen && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-indigo-600 animate-pulse" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Google Drive Transcript Import
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsDriveModalOpen(false)}
            className="text-slate-450 hover:text-slate-600 font-bold text-lg p-1"
          >
            ×
          </button>
        </div>

        {/* Account / Auth Status info */}
        {driveUser && (
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[10px]">
            <span className="text-slate-600 font-mono">
              Connected: <strong>{driveUser.email}</strong>
            </span>
            <button
              type="button"
              onClick={async () => {
                await googleSignOut();
                setDriveUser(null);
                setDriveAccessToken(null);
                setDriveFiles([]);
              }}
              className="text-red-600 hover:underline font-bold"
            >
              Disconnect
            </button>
          </div>
        )}

        {/* Main content body */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3">
          {driveError && (
            <div className="p-2.5 text-[10px] text-red-700 bg-red-50 border border-red-100 rounded-lg flex items-center gap-1.5 font-medium">
              <span>⚠️ {driveError}</span>
            </div>
          )}

          {/* Search query input */}
          {!isDriveLoading && !isDriveParsing && driveFiles.length > 0 && (
            <div className="relative">
              <input
                type="text"
                placeholder="Search Google Drive docs..."
                value={driveSearchQuery}
                onChange={(e) => setDriveSearchQuery(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500 font-medium"
              />
            </div>
          )}

          {/* Loading states */}
          {isDriveLoading && (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-indigo-600 font-medium">
              <svg className="animate-spin h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Loading files from Google Drive...</span>
            </div>
          )}

          {isDriveParsing && (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-indigo-600 font-medium">
              <svg className="animate-spin h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Downloading and extracting transcript contents...</span>
            </div>
          )}

          {/* Files list */}
          {!isDriveLoading && !isDriveParsing && (
            <div className="space-y-1.5">
              {(() => {
                const filtered = driveFiles.filter((f) =>
                  f.name.toLowerCase().includes(driveSearchQuery.toLowerCase())
                );

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-10 border border-dashed border-slate-200 rounded-lg">
                      <FolderOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs text-slate-500 font-semibold">No supported documents found</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Create or upload a Google Doc, .txt, or .docx file in Google Drive!
                      </p>
                    </div>
                  );
                }

                return filtered.map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => handleImportDriveFile(file)}
                    className="w-full text-left p-2.5 rounded-lg border border-slate-150 hover:border-indigo-300 hover:bg-indigo-50/20 transition-all flex items-center justify-between gap-3 cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate group-hover:text-indigo-950">
                          {file.name}
                        </p>
                        <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                          {file.mimeType.includes("document") ? "Google Doc" : file.mimeType.includes("word") ? "Word Document" : "Plain Text"}
                        </p>
                      </div>
                    </div>
                    <span className="text-[9px] text-slate-400 shrink-0 font-mono font-medium">
                      {new Date(file.modifiedTime).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </button>
                ));
              })()}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setIsDriveModalOpen(false)}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer shadow-3xs"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  )
}
        </AnimatePresence >

  {/* First-Time Setup & Workspace Identity Setup Modal */ }
  <AnimatePresence>
{
  isSetupModalOpen && (
    <div
      onClick={() => setIsAuthModalOpen(false)}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full p-6 text-slate-800 relative overflow-y-auto max-h-[90vh] cursor-default"
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">
              {authModalMode === "login" ? "🔑" : authModalMode === "register" ? "👤" : "⚙️"}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {authModalMode === "login"
                  ? "Workspace Sign In"
                  : authModalMode === "register"
                    ? "Create Account & Password"
                    : "Edit Workspace Profile"}
              </h2>
              <p className="text-xs text-slate-500">
                {authModalMode === "login"
                  ? "Log in with email & password or Google"
                  : authModalMode === "register"
                    ? "Set up your credentials for secure thread access"
                    : "Update profile name, email, or password"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsAuthModalOpen(false)}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            title="Close Modal"
          >
            ✕
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl my-3">
          <button
            type="button"
            onClick={() => {
              setAuthModalMode("login");
              setSetupError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${authModalMode === "login"
              ? "bg-white text-indigo-700 shadow-2xs"
              : "text-slate-500 hover:text-slate-800"
              }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthModalMode("register");
              setSetupError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${authModalMode === "register"
              ? "bg-white text-indigo-700 shadow-2xs"
              : "text-slate-500 hover:text-slate-800"
              }`}
          >
            Register Account
          </button>
          {authModalMode === "edit" && (
            <button
              type="button"
              className="flex-1 py-1.5 text-xs font-bold rounded-lg bg-white text-indigo-700 shadow-2xs"
            >
              Edit Profile
            </button>
          )}
        </div>

        <div className="py-2 space-y-3.5 text-xs">
          {setupError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-lg text-xs font-semibold">
              ⚠️ {setupError}
            </div>
          )}

          {/* Google Sign-In Option */}
          <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-2">
            <div className="text-[11px] font-bold text-indigo-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                Quick Google Login
              </span>
              <span className="text-[9px] text-indigo-500 font-mono">No Password Needed</span>
            </div>
            <button
              type="button"
              onClick={handleGoogleAuthLogin}
              disabled={isGoogleSigningIn}
              className="w-full flex items-center justify-center gap-2.5 py-2 px-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 shadow-2xs hover:shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {isGoogleSigningIn ? (
                <span className="animate-pulse">Signing in with Google...</span>
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Sign in with Google Account</span>
                </>
              )}
            </button>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="shrink mx-3 text-[10px] font-bold text-slate-400 uppercase font-mono">
              Or Use Email & Password
            </span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          <div className="space-y-3">
            {(authModalMode === "register" || authModalMode === "edit") && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Workspace Host"
                  value={setupName}
                  onChange={(e) => setSetupName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                placeholder="e.g. your-email@domain.com"
                value={setupEmail}
                onChange={(e) => setSetupEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700 flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                  Password{" "}
                  {authModalMode === "register" && <span className="text-red-500">*</span>}
                </label>
                {authModalMode === "edit" && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    {userPasswords[setupEmail] ? "🔒 Password Set" : "🔓 Optional to update"}
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder={
                    authModalMode === "login"
                      ? "Enter your password..."
                      : authModalMode === "register"
                        ? "Create a secure password (min 4 chars)..."
                        : "Enter new password (or leave as is)..."
                  }
                  value={setupPassword}
                  onChange={(e) => setSetupPassword(e.target.value)}
                  className="w-full pl-3 pr-10 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Primary Timezone</label>
              <select
                value={setupTimezone}
                onChange={(e) => setSetupTimezone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white cursor-pointer"
              >
                {PRESET_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(false)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSaveProfile}
              className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              {authModalMode === "login" ? (
                <>
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </>
              ) : authModalMode === "register" ? (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create Account & Save Password</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Save Profile Changes</span>
                </>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={handleContinueAsGuest}
            className="w-full py-2 px-3 border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <span>👤 Continue as Guest (Preview Mode)</span>
          </button>

          <div className="pt-2 border-t border-slate-100 text-center text-[10.5px] text-slate-500 font-sans">
            By signing in or continuing, you agree to our{" "}
            <button
              type="button"
              onClick={() => setActiveLegalModal("terms")}
              className="text-indigo-600 hover:underline font-semibold cursor-pointer"
            >
              Terms of Service
            </button>{" "}
            and{" "}
            <button
              type="button"
              onClick={() => setActiveLegalModal("privacy")}
              className="text-indigo-600 hover:underline font-semibold cursor-pointer"
            >
              Privacy Policy
            </button>.
          </div>
        </div>
      </motion.div>
    </div>
  )
}
        </AnimatePresence >

  {/* Global Privacy Policy & Terms of Service Modal */ }
  <AnimatePresence>
{
  activeLegalModal && (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md"
      onClick={() => {
        if (isLegalAccepted) {
          setActiveLegalModal(null);
        }
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-3xl flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {activeLegalModal === "privacy" ? (
          <PrivacyPolicy onClose={() => setActiveLegalModal(null)} />
        ) : (
          <TermsOfService onClose={() => setActiveLegalModal(null)} />
        )}
      </motion.div>
    </div>
  )
}
        </AnimatePresence >

  {/* Floating Global Feedback Toast */ }
  <AnimatePresence>
{
  saveSuccessMessage && (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className="fixed bottom-6 left-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 text-xs font-semibold flex items-center gap-2.5 max-w-sm pointer-events-none"
    >
      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
      <span className="flex-1">{saveSuccessMessage}</span>
    </motion.div>
  )
}
        </AnimatePresence >

  {/* Grounded Assistant Chatbot Widget */ }
  < SynchronChatbot
key = {`chatbot-${currentUserEmail || "guest"}-${logoutCount}`}
meetingContext = {{
  rawTranscript: transcript,
    extractedTasks: recapData?.actionItems?.map((item) => ({
      task: item.task,
      assignee: item.assignee,
      deadline: item.deadline,
      priority: (item as any).priority || "Medium"
    })),
      attendees: attendees.map((a) => ({
        name: a.name,
        locationOrTimezone: a.timezone
      })),
        proposedSlots: proposedSlots.map((s) => ({
          slot: s.utcDate ? new Date(s.utcDate).toUTCString() : "Slot",
          score: s.score || 0,
          type: s.badge === "GOLD" || s.overallRating === "Perfect" ? "Gold" : s.badge === "SILVER" || s.overallRating === "Good" ? "Silver" : "Bronze"
        }))
}}
        />
      </div >

  {/* Blocking Legal Consent Gate */ }
{
  !isLegalAccepted && (
    <LegalConsentModal
      onConsentGiven={() => setIsLegalAccepted(true)}
    />
  )
}
    </div >
  );
}
