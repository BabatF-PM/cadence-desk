import React, { useState } from 'react';
import { Copy, Check, ExternalLink, Mail } from 'lucide-react';

interface ContactUsWidgetProps {
  sectionTitle?: string;
  description?: string;
}

export const ContactUsWidget: React.FC<ContactUsWidgetProps> = ({
  sectionTitle = "4. Contact Us",
  description = "For questions regarding this policy or AI data handling practices, reach out to us:"
}) => {
  const [copied, setCopied] = useState(false);
  const email = "cadancedesk@gmail.com";

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(email);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenGmail = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}`;
    window.open(gmailUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-3 pt-2">
      <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
        <Mail size={18} className="text-indigo-600" />
        <span>{sectionTitle}</span>
      </h3>
      <p className="text-slate-600 text-xs sm:text-sm">
        {description}
      </p>

      <div className="flex flex-wrap items-center gap-2 bg-slate-900 p-3 rounded-xl border border-slate-800 w-fit text-white shadow-sm">
        <span className="text-indigo-300 font-mono text-xs sm:text-sm font-semibold px-1">
          {email}
        </span>

        {/* Copy Button */}
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check size={14} className="text-emerald-400" />
              <span className="text-emerald-400 font-semibold">Copied!</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span>Copy</span>
            </>
          )}
        </button>

        {/* Web Gmail Direct Launcher */}
        <button
          type="button"
          onClick={handleOpenGmail}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
        >
          <span>Open Web Gmail</span>
          <ExternalLink size={12} />
        </button>
      </div>
    </div>
  );
};
