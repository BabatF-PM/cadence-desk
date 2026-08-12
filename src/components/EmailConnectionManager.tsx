import React from "react";
import {
  ShieldCheck,
  Globe,
  Server,
  Lock,
  LogIn,
  Info,
  RotateCcw,
  Check
} from "lucide-react";

export interface SmtpConfig {
  providerName: string;
  senderName: string;
  senderEmail: string;
  smtpHost: string;
  smtpPort: number;
  appPassword?: string;
}

export interface EmailConnectionManagerProps {
  isAuthenticated: boolean;
  isGuestMode?: boolean;
  user?: { name?: string; email?: string } | null;
  currentUserEmail: string;
  isEmailConnected: boolean;
  isGoogleConnected: boolean;
  driveUser: any;
  emailConnectionType: "google" | "smtp";
  setEmailConnectionType: (type: "google" | "smtp") => void;
  smtpConfig: SmtpConfig;
  setSmtpConfig: React.Dispatch<React.SetStateAction<SmtpConfig>>;
  smtpConfigSaved: boolean;
  setSmtpConfigSaved: (saved: boolean) => void;
  smtpSaveSuccessMessage: string | null;
  setSmtpSaveSuccessMessage: (msg: string | null) => void;
  googleSignIn: () => Promise<any>;
  googleSignOut: () => Promise<void>;
  setDriveUser: (user: any) => void;
  setDriveAccessToken: (token: string | null) => void;
  setDriveFiles: (files: any[]) => void;
  setSmtpStatus: (status: any) => void;
  setSmtpLogs: React.Dispatch<React.SetStateAction<string[]>>;
  setGmailConnectionWarning: (msg: string | null) => void;
  setPreLoginWarning: (msg: string | null) => void;
  setError: (msg: string | null) => void;
  setAgentLogs: React.Dispatch<React.SetStateAction<string[]>>;
  onOpenLoginModal: () => void;
  onOpenPrivacy?: () => void;
  onOpenTerms?: () => void;
}

export const EmailConnectionManager: React.FC<EmailConnectionManagerProps> = ({
  isAuthenticated,
  isGuestMode = false,
  user,
  currentUserEmail,
  isEmailConnected,
  isGoogleConnected,
  driveUser,
  emailConnectionType,
  setEmailConnectionType,
  smtpConfig,
  setSmtpConfig,
  smtpConfigSaved,
  setSmtpConfigSaved,
  smtpSaveSuccessMessage,
  setSmtpSaveSuccessMessage,
  googleSignIn,
  googleSignOut,
  setDriveUser,
  setDriveAccessToken,
  setDriveFiles,
  setSmtpStatus,
  setSmtpLogs,
  setGmailConnectionWarning,
  setPreLoginWarning,
  setError,
  setAgentLogs,
  onOpenLoginModal,
  onOpenPrivacy,
  onOpenTerms
}) => {
  const activeUserEmail = user?.email || currentUserEmail;
  const isUserLoggedIn = isAuthenticated && !!activeUserEmail && activeUserEmail !== "unassigned";

  return (
    <div id="email-account-connect-card" className="bg-gradient-to-r from-indigo-50/60 via-slate-50/80 to-blue-50/50 border border-indigo-200/70 rounded-xl p-3.5 text-left space-y-3 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-indigo-100/80 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isEmailConnected ? "bg-emerald-400" : "bg-amber-400"}`}></span>
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isEmailConnected ? "bg-emerald-500" : "bg-amber-500"}`}></span>
          </span>
          <div>
            <span className="text-[12px] font-extrabold text-slate-850 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600 inline" />
              Email Connection Manager
            </span>
            <span className="text-[10px] text-slate-500 block">
              {isEmailConnected ? (
                <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Connected</span>
                  <span className="text-slate-300">•</span>
                  <span>{isGoogleConnected ? `Google OAuth (${driveUser?.email || "Gmail Account"})` : `SMTP (${smtpConfig.smtpHost || "Server"}) — ${smtpConfig.senderEmail}`}</span>
                </span>
              ) : (
                <span className="text-amber-700 font-medium flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>No Outbox Connected — Choose a provider below to authorize direct email send.</span>
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Connection Mode Toggle */}
        <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-3xs shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setEmailConnectionType("google")}
            className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
              emailConnectionType === "google" 
                ? "bg-indigo-600 text-white shadow-xs" 
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Globe className="w-3 h-3" />
            <span>Google / Gmail (OAuth)</span>
          </button>
          <button
            type="button"
            onClick={() => setEmailConnectionType("smtp")}
            className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
              emailConnectionType === "smtp" 
                ? "bg-indigo-600 text-white shadow-xs" 
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Server className="w-3 h-3" />
            <span>Connect Any Email (SMTP)</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Google OAuth Connection */}
      {emailConnectionType === "google" && (
        <div className="space-y-2.5 pt-0.5">
              {/* Explicit Permission Transparency Notice */}
              <div className="bg-indigo-50/90 border border-indigo-200/80 rounded-lg p-2.5 text-[10.5px] text-indigo-950 flex flex-col gap-1 shadow-2xs">
                <div className="flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                  <span className="leading-snug font-medium">
                    ℹ️ Connecting your Google account grants secure permission to send follow-up emails directly from this workspace on your behalf.
                  </span>
                </div>
                {(onOpenPrivacy || onOpenTerms) && (
                  <div className="pl-5 text-[10px] text-indigo-800/80 flex items-center gap-2">
                    <span>Review:</span>
                    {onOpenPrivacy && (
                      <button
                        type="button"
                        onClick={onOpenPrivacy}
                        className="underline hover:text-indigo-950 cursor-pointer font-semibold"
                      >
                        Privacy Policy
                      </button>
                    )}
                    {onOpenPrivacy && onOpenTerms && <span>•</span>}
                    {onOpenTerms && (
                      <button
                        type="button"
                        onClick={onOpenTerms}
                        className="underline hover:text-indigo-950 cursor-pointer font-semibold"
                      >
                        Terms of Service
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div id="google-account-connect-card" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/90 border border-slate-200 rounded-xl p-3">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                    Google OAuth Status
                  </span>
                  {driveUser ? (
                    <p className="text-[10px] text-slate-600 leading-normal">
                      Connected as: <span className="font-mono font-bold text-indigo-900 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5">{driveUser.email}</span>
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-500 leading-normal">
                      Not authorized yet. Connect Google for real-time secure email dispatching via Gmail APIs.
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  {driveUser ? (
                    <>
                      <button
                        type="button"
                        onClick={async () => {
                          await googleSignOut();
                          setDriveUser(null);
                          setDriveAccessToken(null);
                          setDriveFiles([]);
                          setSmtpStatus("not_sent");
                        }}
                        className="text-[10px] bg-white border border-slate-200 text-red-600 hover:bg-red-50 font-bold px-3 py-1.5 rounded-lg shadow-3xs cursor-pointer transition-all"
                      >
                        Disconnect
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setSmtpStatus("sending");
                          setSmtpLogs(["Gmail 🔑 Requesting a fresh sign-in popup to grant newly added Gmail permissions..."]);
                          try {
                            const result = await googleSignIn();
                            if (result) {
                              setDriveUser(result.user);
                              setDriveAccessToken(result.accessToken);
                              setSmtpLogs(prev => [...prev, "Gmail ✅ Successfully re-authorized with fresh permissions! ready to send."]);
                              setSmtpStatus("not_sent");
                              setPreLoginWarning(null);
                              setGmailConnectionWarning(null);
                              setError(null);
                            }
                          } catch (err: any) {
                            setSmtpLogs(prev => [...prev, `Gmail ❌ Re-authorization failed: ${err.message || err}`]);
                            setSmtpStatus("not_sent");
                          }
                        }}
                        className="text-[10px] bg-indigo-600 text-white hover:bg-indigo-700 font-bold px-3 py-1.5 rounded-lg shadow-xs cursor-pointer transition-all flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Re-authorize Gmail</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      id="connect-google-account-btn"
                      onClick={async () => {
                        setSmtpStatus("sending");
                        setSmtpLogs(["Gmail 🔑 Requesting Google Sign-In popup window..."]);
                        try {
                          const result = await googleSignIn();
                          if (result) {
                            setDriveUser(result.user);
                            setDriveAccessToken(result.accessToken);
                            setSmtpLogs(prev => [...prev, `Gmail ✅ Successfully connected as ${result.user.email}!`]);
                            setSmtpStatus("not_sent");
                            setPreLoginWarning(null);
                            setGmailConnectionWarning(null);
                            setError(null);
                          } else {
                            setSmtpLogs(prev => [
                              ...prev,
                              "Gmail ⚠️ Sign-in popup was blocked by browser security or closed.",
                              "💡 Tip: If you are in the AI Studio preview iframe, click 'Open in new tab' (top right of preview) to allow Google auth popups."
                            ]);
                            setSmtpStatus("not_sent");
                          }
                        } catch (err: any) {
                          console.error(err);
                          setSmtpLogs(prev => [...prev, `Gmail ❌ Connection error: ${err.message || err}`]);
                          setSmtpStatus("not_sent");
                        }
                      }}
                      className="text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg shadow-xs cursor-pointer transition-all"
                    >
                      Connect Google Account
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Universal SMTP Connection */}
          {emailConnectionType === "smtp" && (
            <div className="space-y-2.5 pt-0.5">
              {/* Preset Quick Selectors */}
              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[9px]">Provider Presets:</span>
                <button
                  type="button"
                  onClick={() => setSmtpConfig(prev => ({ ...prev, providerName: "Outlook / Office365", smtpHost: "smtp.office365.com", smtpPort: 587 }))}
                  className={`px-2 py-0.5 rounded border font-semibold cursor-pointer transition-all ${
                    smtpConfig.providerName === "Outlook / Office365"
                      ? "bg-indigo-100 border-indigo-300 text-indigo-800"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Outlook / Office 365
                </button>
                <button
                  type="button"
                  onClick={() => setSmtpConfig(prev => ({ ...prev, providerName: "Yahoo Mail", smtpHost: "smtp.mail.yahoo.com", smtpPort: 587 }))}
                  className={`px-2 py-0.5 rounded border font-semibold cursor-pointer transition-all ${
                    smtpConfig.providerName === "Yahoo Mail"
                      ? "bg-indigo-100 border-indigo-300 text-indigo-800"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Yahoo Mail
                </button>
                <button
                  type="button"
                  onClick={() => setSmtpConfig(prev => ({ ...prev, providerName: "Custom Server", smtpHost: "smtp.yourdomain.com", smtpPort: 587 }))}
                  className={`px-2 py-0.5 rounded border font-semibold cursor-pointer transition-all ${
                    smtpConfig.providerName === "Custom Server"
                      ? "bg-indigo-100 border-indigo-300 text-indigo-800"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Custom Server
                </button>
              </div>

              {/* SMTP Form Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-white/90 border border-slate-200 rounded-xl p-3">
                <div>
                  <label className="text-[9.5px] font-bold uppercase text-slate-500 block mb-1">Provider Name / Custom Server</label>
                  <input
                    type="text"
                    value={smtpConfig.providerName}
                    onChange={(e) => setSmtpConfig(prev => ({ ...prev, providerName: e.target.value }))}
                    placeholder="e.g. Outlook / Office365"
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500 font-medium"
                  />
                </div>

                <div>
                  <label className="text-[9.5px] font-bold uppercase text-slate-500 block mb-1">Sender Name</label>
                  <input
                    type="text"
                    value={smtpConfig.senderName}
                    onChange={(e) => setSmtpConfig(prev => ({ ...prev, senderName: e.target.value }))}
                    placeholder="e.g. Workspace Host"
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500 font-medium"
                  />
                </div>

                <div>
                  <label className="text-[9.5px] font-bold uppercase text-slate-500 block mb-1">Sender Email Address *</label>
                  <input
                    type="email"
                    value={smtpConfig.senderEmail}
                    onChange={(e) => setSmtpConfig(prev => ({ ...prev, senderEmail: e.target.value }))}
                    placeholder="e.g. your-email@domain.com"
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500 font-medium"
                  />
                </div>

                <div>
                  <label className="text-[9.5px] font-bold uppercase text-slate-500 block mb-1">SMTP Host *</label>
                  <input
                    type="text"
                    value={smtpConfig.smtpHost}
                    onChange={(e) => setSmtpConfig(prev => ({ ...prev, smtpHost: e.target.value }))}
                    placeholder="e.g. smtp.office365.com"
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500 font-medium font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="text-[9.5px] font-bold uppercase text-slate-500 block mb-1">Port</label>
                  <input
                    type="number"
                    value={smtpConfig.smtpPort}
                    onChange={(e) => setSmtpConfig(prev => ({ ...prev, smtpPort: parseInt(e.target.value, 10) || 587 }))}
                    placeholder="587 or 465"
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500 font-medium"
                  />
                </div>

                <div>
                  <label className="text-[9.5px] font-bold uppercase text-slate-500 block mb-1">App Password / Security Key</label>
                  <input
                    type="password"
                    value={smtpConfig.appPassword || ""}
                    onChange={(e) => setSmtpConfig(prev => ({ ...prev, appPassword: e.target.value }))}
                    placeholder="••••••••••••"
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500 font-medium font-mono"
                  />
                </div>
              </div>

              {/* Save & Disconnect controls */}
              <div className="flex items-center justify-between gap-2 pt-0.5">
                {smtpSaveSuccessMessage && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1 animate-fade-in">
                    {smtpSaveSuccessMessage}
                  </span>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  {smtpConfigSaved && (
                    <button
                      type="button"
                      onClick={() => {
                        setSmtpConfigSaved(false);
                        if (typeof localStorage !== "undefined") {
                          localStorage.removeItem("cadence_smtp_config");
                          localStorage.removeItem("m_synchron_smtp_config");
                        }
                      }}
                      className="text-[10px] bg-white border border-slate-200 text-red-600 hover:bg-red-50 font-bold px-3 py-1.5 rounded-lg shadow-3xs cursor-pointer transition-all"
                    >
                      Disconnect SMTP
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (!smtpConfig.senderEmail || !smtpConfig.smtpHost) {
                        setError("Please provide a valid Sender Email Address and SMTP Host.");
                        return;
                      }
                      setSmtpConfigSaved(true);
                      if (typeof localStorage !== "undefined") {
                        localStorage.setItem("cadence_smtp_config", JSON.stringify(smtpConfig));
                      }
                      setGmailConnectionWarning(null);
                      setError(null);
                      setSmtpSaveSuccessMessage(`Connected via Universal SMTP (${smtpConfig.senderEmail})`);
                      setTimeout(() => setSmtpSaveSuccessMessage(null), 3000);
                    }}
                    className="text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-1.5 rounded-lg shadow-xs cursor-pointer transition-all flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    <span>{smtpConfigSaved ? "Update SMTP Credentials" : "Save & Connect SMTP"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
    </div>
  );
};

export default EmailConnectionManager;
