import "server-only";
import { Resend } from "resend";

// Fails open in dev / before Resend is configured — logs instead of sending, so
// local auth flows don't hard-crash on a missing key (mirrors the Upstash/YouTube
// optional-service pattern).
const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;
const FROM = process.env.EMAIL_FROM ?? "TierHub <noreply@tierhub.app>";

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY not set — skipping "${opts.subject}" to ${opts.to}`
    );
    return;
  }
  const { error } = await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
  if (error) console.error(`[email] send failed:`, error);
}
