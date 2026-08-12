import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShieldCheck, Lock, CheckCircle2, FileText, ArrowRight, Info, AlertTriangle } from "lucide-react";
import { PrivacyPolicy } from "./PrivacyPolicy";
import { TermsOfService } from "./TermsOfService";

interface LegalConsentModalProps {
  onConsentGiven: () => void;
  onViewPrivacy?: () => void;
  onViewTerms?: () => void;
}

export const LegalConsentModal: React.FC<LegalConsentModalProps> = ({
  onConsentGiven
}) => {
  const [hasAgreedTerms, setHasAgreedTerms] = useState(false);
  const [hasAgreedPrivacy, setHasAgreedPrivacy] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<"privacy" | "terms" | null>(null);

  const handleAccept = () => {
    if (!hasAgreedTerms || !hasAgreedPrivacy) return;

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

    onConsentGiven();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-xl overflow-hidden flex flex-col my-auto"
          onClick={(e) => e.stopPropagation()} // Prevent any outside click dismissal
        >
          {/* Header Banner */}
          <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400 border border-indigo-500/30">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold uppercase tracking-wider text-slate-100 font-mono">
                  Cadence Desk
                </h2>
                <p className="text-[11px] text-slate-400 font-mono">
                  Mandatory Legal & Privacy Compliance Gate
                </p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-indigo-950/80 border border-indigo-800/60 rounded-full text-[10.5px] font-mono text-indigo-300">
              <Lock className="w-3 h-3 text-indigo-400" />
              <span>Zero-Cloud Protected</span>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-5 text-slate-700 text-xs leading-relaxed">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-slate-900 text-xs">Welcome to Cadence Desk</h3>
                  <p className="text-[11.5px] text-slate-600 mt-0.5">
                    Before entering the workspace, please review and accept our Terms of Service and Privacy Policy.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 text-[11px] text-slate-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Zero-Cloud Local Memory Processing</span>
                </div>
                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 text-[11px] text-slate-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Human-in-the-Loop Email Review</span>
                </div>
              </div>
            </div>

            {/* Checkboxes Group */}
            <div className="space-y-3.5 pt-1">
              {/* Checkbox 1: Terms */}
              <label className="flex items-start gap-3 p-3.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl transition cursor-pointer group shadow-2xs">
                <input
                  type="checkbox"
                  checked={hasAgreedTerms}
                  onChange={(e) => setHasAgreedTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                />
                <div className="text-[11.5px] leading-snug">
                  <span className="font-semibold text-slate-800">
                    I agree to the Terms of Service.
                  </span>{" "}
                  <span className="text-slate-500">
                    I understand that AI outputs require human verification and that session data is maintained locally.
                  </span>{" "}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setViewingDoc("terms");
                    }}
                    className="text-indigo-600 font-semibold underline hover:text-indigo-800 cursor-pointer inline-flex items-center gap-0.5 ml-1"
                  >
                    Read Terms
                    <FileText className="w-3 h-3" />
                  </button>
                </div>
              </label>

              {/* Checkbox 2: Privacy */}
              <label className="flex items-start gap-3 p-3.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl transition cursor-pointer group shadow-2xs">
                <input
                  type="checkbox"
                  checked={hasAgreedPrivacy}
                  onChange={(e) => setHasAgreedPrivacy(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                />
                <div className="text-[11.5px] leading-snug">
                  <span className="font-semibold text-slate-800">
                    I agree to the Privacy Policy.
                  </span>{" "}
                  <span className="text-slate-500">
                    Including zero-cloud local RAM processing, encrypted API transit, and optional Google OAuth outbox usage.
                  </span>{" "}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setViewingDoc("privacy");
                    }}
                    className="text-indigo-600 font-semibold underline hover:text-indigo-800 cursor-pointer inline-flex items-center gap-0.5 ml-1"
                  >
                    Read Privacy Policy
                    <FileText className="w-3 h-3" />
                  </button>
                </div>
              </label>
            </div>

            {/* Warning when incomplete */}
            {(!hasAgreedTerms || !hasAgreedPrivacy) && (
              <div className="flex items-center gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200/80 px-3 py-2 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Please select both checkboxes above to accept the legal agreements and unlock the workspace.</span>
              </div>
            )}
          </div>

          {/* Footer Action */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="text-[10.5px] text-slate-400 font-mono">
              Audit record will be stored locally on device.
            </div>
            <button
              type="button"
              onClick={handleAccept}
              disabled={!hasAgreedTerms || !hasAgreedPrivacy}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
                hasAgreedTerms && hasAgreedPrivacy
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 font-semibold"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300/60"
              }`}
            >
              <span>Accept & Enter Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </div>

      {/* Embedded Document Modals */}
      <AnimatePresence>
        {viewingDoc && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md"
            onClick={(e) => {
              e.stopPropagation();
              setViewingDoc(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-3xl flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {viewingDoc === "privacy" && (
                <PrivacyPolicy onClose={() => setViewingDoc(null)} isAccepted={true} />
              )}
              {viewingDoc === "terms" && (
                <TermsOfService onClose={() => setViewingDoc(null)} isAccepted={true} />
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
