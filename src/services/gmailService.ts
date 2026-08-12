/**
 * Gmail & Outbox Service Layer
 * Handles recipient validation, email syntax verification, placeholder domain filtering,
 * and outbox payload preparation.
 */

export const PLACEHOLDER_DOMAINS = [
  "company.com",
  "example.com",
  "domain.com",
  "test.com",
  "placeholder.com",
  "sample.com",
  "invalid.com",
  "local.com",
  "mysite.com",
  "yourcompany.com"
];

// RFC 5322 compliant email regex pattern
export const RFC_EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export interface SingleValidationResult {
  isValid: boolean;
  reason?: "empty" | "syntax" | "placeholder";
  message?: string;
}

export interface ListValidationResult {
  isValid: boolean;
  reason?: "empty" | "syntax" | "placeholder";
  message?: string;
  invalidEmails: string[];
  placeholderEmails: string[];
  validEmails: string[];
}

/**
 * Checks if a given email uses a generic placeholder domain.
 */
export function isPlaceholderDomain(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const parts = email.trim().toLowerCase().split("@");
  if (parts.length !== 2) return false;
  const domain = parts[1];
  return PLACEHOLDER_DOMAINS.includes(domain);
}

/**
 * Validates email syntax against standard RFC 5322 regex.
 */
export function isValidEmailSyntax(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  return RFC_EMAIL_REGEX.test(email.trim());
}

/**
 * Validates an individual recipient email address.
 */
export function validateRecipientEmail(email: string): SingleValidationResult {
  if (!email || !email.trim()) {
    return {
      isValid: false,
      reason: "empty",
      message: "Recipient email address cannot be empty."
    };
  }

  const cleanEmail = email.trim().toLowerCase();

  if (!isValidEmailSyntax(cleanEmail)) {
    return {
      isValid: false,
      reason: "syntax",
      message: "Invalid recipient address syntax."
    };
  }

  if (isPlaceholderDomain(cleanEmail)) {
    return {
      isValid: false,
      reason: "placeholder",
      message: "Invalid recipient address detected. Please update before sending."
    };
  }

  return { isValid: true };
}

/**
 * Validates a list of recipient email addresses before dispatch.
 */
export function validateRecipientsList(emails: string[]): ListValidationResult {
  const invalidEmails: string[] = [];
  const placeholderEmails: string[] = [];
  const validEmails: string[] = [];

  if (!emails || emails.length === 0) {
    return {
      isValid: false,
      reason: "empty",
      message: "No recipient email addresses provided.",
      invalidEmails,
      placeholderEmails,
      validEmails
    };
  }

  for (const rawEmail of emails) {
    const email = rawEmail.trim();
    if (!email) continue;

    const result = validateRecipientEmail(email);
    if (!result.isValid) {
      if (result.reason === "placeholder") {
        placeholderEmails.push(email);
      } else {
        invalidEmails.push(email);
      }
    } else {
      validEmails.push(email);
    }
  }

  const hasErrors = invalidEmails.length > 0 || placeholderEmails.length > 0;

  return {
    isValid: !hasErrors && validEmails.length > 0,
    reason: placeholderEmails.length > 0 ? "placeholder" : (invalidEmails.length > 0 ? "syntax" : undefined),
    message: hasErrors ? "Invalid recipient address detected. Please update before sending." : undefined,
    invalidEmails,
    placeholderEmails,
    validEmails
  };
}
