import React, { useEffect } from "react";
import { ShieldCheck, X, Lock, Mail, Server, Cpu } from "lucide-react";
import { ContactUsWidget } from "./ContactUsWidget";

interface PrivacyPolicyProps {
  onClose?: () => void;
  onAccept?: () => void;
  isAccepted?: boolean;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({
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
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100 font-mono">
              Privacy Policy
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
        <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-start gap-3 text-indigo-950">
          <Lock className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-xs text-indigo-900">Zero-Cloud, Privacy-First Architecture</h3>
            <p className="text-[11px] text-indigo-800/90 mt-0.5">
              At Cadence Desk ("we," "our," or "us"), we prioritize the privacy and security of your data. All core meeting analysis, transcript processing, and schedule generation occur locally within your browser's volatile memory (RAM).
            </p>
          </div>
        </div>

        {/* Section 1 */}
        <section className="space-y-2 border-b border-slate-100 pb-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-600" />
            1. Information We Process & Local Storage
          </h3>
          <p className="text-slate-600">
            Because Cadence Desk operates client-side, we do not maintain a central database or cloud server to store your meeting content.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
            <li>
              <strong className="text-slate-800">Transcripts & Meeting Content:</strong> Raw transcripts, attendee names, extracted action items, and draft recaps exist strictly in your browser's volatile memory (RAM) during your active session.
            </li>
            <li>
              <strong className="text-slate-800">Local Browser Storage (localStorage):</strong> If you connect outbound email options (such as Google OAuth or Universal SMTP) or accept legal terms, relevant authorization keys (e.g., <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px] font-mono">google_oauth_token</code> or encrypted SMTP settings) and on-device consent logs (<code className="bg-slate-100 px-1 py-0.5 rounded text-[10px] font-mono">cadence_legal_consent_audit</code>) are stored strictly within your browser's local storage.
            </li>
            <li>
              <strong className="text-slate-800">Transient Session Lifecycle:</strong> Refreshing the page, closing the tab, or clicking "Reset Workspace" or "Finish & Clear Session" permanently wipes all transcript and session data from your device's memory.
            </li>
          </ul>
        </section>

        {/* Section 2 */}
        <section className="space-y-2 border-b border-slate-100 pb-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-600" />
            2. Use of Artificial Intelligence & Machine Learning
          </h3>
          <p className="text-slate-600">
            Cadence Desk utilizes advanced artificial intelligence (AI) models (such as Google Gemini API) to perform transcript summarization, action-item extraction, timezone optimization, and email draft compilation.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
            <li>
              <strong className="text-slate-800">Encrypted, Zero-Retention API Processing:</strong> Transcripts are passed to third-party AI processing infrastructure via encrypted HTTPS/TLS connections solely to execute your real-time requests. Payload data is purged from volatile processing memory immediately after inference completes.
            </li>
            <li>
              <strong className="text-slate-800">NO AI Model Training:</strong> Your meeting transcripts, extracted tasks, attendee details, and generated email drafts are NEVER used, logged, stored, or processed by us or our third-party AI providers to train, retrain, fine-tune, or improve public or commercial AI/ML models.
            </li>
            <li>
              <strong className="text-slate-800">Probabilistic Outputs & Mandatory Review:</strong> AI-generated outputs are probabilistic in nature. Users are required to review, verify, and edit all AI-generated content prior to sending or scheduling dispatches.
            </li>
          </ul>
        </section>

        {/* Section 3 */}
        <section className="space-y-2 border-b border-slate-100 pb-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Mail className="w-4 h-4 text-indigo-600" />
            3. Google API Services & Limited Use Disclosure
          </h3>
          <p className="text-slate-600">
            Cadence Desk integrates with Google OAuth to enable users to dispatch meeting recaps directly from their own Gmail outbox.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
            <li>
              <strong className="text-slate-800">OAuth Permission Request:</strong> Cadence Desk requests access to the restricted Google API scope: <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px] font-mono text-indigo-700">https://www.googleapis.com/auth/gmail.send</code>.
            </li>
            <li>
              <strong className="text-slate-800">How We Use Google Data:</strong> This permission is used exclusively to transmit user-approved meeting recaps and follow-up emails directly from your browser to your designated meeting recipients.
            </li>
            <li>
              <strong className="text-slate-800">Google API Limited Use Compliance:</strong> Cadence Desk’s use and transfer to any other app of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.
            </li>
            <li>
              <strong className="text-slate-800">No Server Storage or Ad Targeting:</strong> We do not read or store your existing Gmail inbox. Google credentials and user data are never transferred to external servers, sold to third parties, shared with advertisers, or utilized to train AI models.
            </li>
          </ul>
        </section>

        {/* Section 4 */}
        <ContactUsWidget
          sectionTitle="4. Contact Us"
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
            {isAccepted ? "Close Privacy Policy" : "Accept & Close Privacy Policy"}
          </button>
        )}
      </div>
    </div>
  );
};

export default PrivacyPolicy;
