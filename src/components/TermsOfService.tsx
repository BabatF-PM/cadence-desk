import React, { useEffect } from "react";
import { FileText, X, AlertTriangle, CheckSquare, Shield, Mail } from "lucide-react";
import { ContactUsWidget } from "./ContactUsWidget";

interface TermsOfServiceProps {
  onClose?: () => void;
  onAccept?: () => void;
  isAccepted?: boolean;
}

export const TermsOfService: React.FC<TermsOfServiceProps> = ({
  onClose,
  onAccept,
  isAccepted: isAcceptedProp
}) => {
  const isAccepted =
    isAcceptedProp !== undefined
      ? isAcceptedProp
      : typeof localStorage !== "undefined" &&
        (localStorage.getItem("cadence_legal_accepted") === "true" ||
          localStorage.getItem("m_synchron_legal_accepted") === "true");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isAccepted && onClose) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAccepted, onClose]);

  const handleFooterClick = () => {
    if (isAccepted) {
      if (onClose) onClose();
    } else {
      const auditRecord = {
        accepted: true,
        appName: "Cadence Desk",
        policyVersion: "v1.0-2026",
        acceptedAt: new Date().toISOString(),
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
        clientLocale: typeof navigator !== "undefined" ? navigator.language : "en-US"
      };

      if (typeof localStorage !== "undefined") {
        localStorage.setItem("cadence_legal_consent_audit", JSON.stringify(auditRecord));
        localStorage.setItem("cadence_legal_accepted", "true");
      }

      if (onAccept) {
        onAccept();
      } else if (onClose) {
        onClose();
      }
    }
  };

  return (
    <div
      className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-indigo-500/20 rounded-lg text-indigo-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100 font-mono">
              Terms and Conditions
            </h2>
            <p className="text-[10px] text-slate-400 font-mono">
              Effective Date: August 11, 2026
            </p>
          </div>
        </div>
        {isAccepted && onClose && (
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Content Scroll Area */}
      <div className="p-6 overflow-y-auto space-y-6 text-slate-700 text-xs leading-relaxed font-sans">
        {/* Banner */}
        <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-start gap-3 text-amber-950">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-xs text-amber-900">Mandatory Human-in-the-Loop Review</h3>
            <p className="text-[11px] text-amber-800/90 mt-0.5">
              Cadence Desk uses automated AI agents to summarize meetings and draft communications. You are strictly required to review, verify, and edit all AI-generated outputs prior to sending or relying on dispatches.
            </p>
          </div>
        </div>

        {/* Section 1 */}
        <section className="space-y-2 border-b border-slate-100 pb-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-600" />
            1. Zero-Cloud Architecture & Data Loss Disclaimer
          </h3>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
            <li>
              <strong className="text-slate-800">Client-Side Processing:</strong> Cadence Desk functions as a client-side web application. Data is processed locally in volatile browser memory (RAM) or stored locally in your browser's localStorage.
            </li>
            <li>
              <strong className="text-slate-800">Session Persistence:</strong> You acknowledge that Cadence Desk maintains no backend database backups or server logs of your transcripts, attendee lists, or generated summaries. Closing your browser tab, clearing local site data, or clicking "Reset Workspace" permanently purges your session data.
            </li>
          </ul>
        </section>

        {/* Section 2 */}
        <section className="space-y-2 border-b border-slate-100 pb-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-indigo-600" />
            2. AI Autopilot & Human-in-the-Loop Requirement
          </h3>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
            <li>
              <strong className="text-slate-800">AI Accuracy:</strong> Cadence Desk uses automated AI agents to summarize meetings and draft communications. AI outputs are probabilistic and may occasionally contain inaccuracies, omissions, or misinterpretations of raw transcript text.
            </li>
            <li>
              <strong className="text-slate-800">Mandatory User Review:</strong> You are strictly responsible for reviewing, verifying, and editing all AI-generated content (including action items, owner assignments, timezone meeting slots, and email draft bodies) before sending, scheduling, or relying on such information.
            </li>
            <li>
              <strong className="text-slate-800">Outbox Dispatches:</strong> Email dispatches sent from connected outboxes (Google OAuth or SMTP) are initiated at your explicit command. Cadence Desk assumes no liability for missed deadlines, incorrect meeting scheduling, or errors contained within AI-drafted emails.
            </li>
          </ul>
        </section>

        {/* Section 3 */}
        <section className="space-y-2 border-b border-slate-100 pb-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Mail className="w-4 h-4 text-indigo-600" />
            3. Outbox Connections & API Usage
          </h3>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
            <li>
              <strong className="text-slate-800">Third-Party Credentials:</strong> Connecting a Google OAuth account or Universal SMTP configuration stores authorization credentials strictly inside your browser's local storage.
            </li>
            <li>
              <strong className="text-slate-800">Acceptable Use:</strong> You agree not to use Cadence Desk, its outbox features, or Google API integrations to send unsolicited bulk communications (spam), malicious content, or violating materials.
            </li>
          </ul>
        </section>

        {/* Section 4 */}
        <section className="space-y-2 border-b border-slate-100 pb-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-indigo-600" />
            4. Limitation of Liability
          </h3>
          <p className="text-slate-600">
            To the maximum extent permitted by law, Cadence Desk and its developers shall not be liable for any indirect, incidental, consequential, or special damages arising out of or in connection with your use of the application.
          </p>
        </section>

        {/* Section 5 */}
        <ContactUsWidget
          sectionTitle="5. Contact Information"
          description="For support, questions, or policy inquiries, reach out to us:"
        />
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono shrink-0">
        <span>Cadence Desk Terms & Policies</span>
        {onClose && (
          <button
            onClick={handleFooterClick}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
          >
            {isAccepted ? "Close Terms" : "Accept & Close Terms"}
          </button>
        )}
      </div>
    </div>
  );
};

export default TermsOfService;
