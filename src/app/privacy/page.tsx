import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "TierHub Privacy Policy — how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl flex-1 px-4 py-12 text-foreground">
      <h1 className="text-3xl font-extrabold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: July 2, 2026
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed">
        <section>
          <h2 className="mb-2 text-lg font-semibold">1. Information We Collect</h2>
          <p className="text-muted-foreground">
            When you create an account on TierHub, we collect the information you
            provide — such as your email address and name. If you sign in through a
            third-party provider (Google, GitHub, or Discord), we receive the profile
            information those providers share with us.
          </p>
          <p className="mt-2 text-muted-foreground">
            When you create, edit, or share tier lists, we store the content you
            submit — including text, images, and videos you upload. We also store
            metadata like creation dates and view counts.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">2. How We Use Your Information</h2>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>To provide, maintain, and improve the TierHub service.</li>
            <li>To send transactional emails (e.g., password resets, account notifications).</li>
            <li>To power AI-generated tier-list suggestions when you use that feature.</li>
            <li>To detect and prevent abuse, fraud, or violations of our Terms of Service.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">3. Cookies</h2>
          <p className="text-muted-foreground">
            TierHub uses essential cookies to maintain your authenticated session and
            remember your theme preference (light or dark mode). We do not use
            advertising or tracking cookies.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">4. Data Retention</h2>
          <p className="text-muted-foreground">
            We retain your account information and tier-list content for as long as
            your account remains active. If you delete your account, we remove your
            personal data and tier lists within a reasonable timeframe. Publicly
            shared tier lists may continue to exist in cached or archived form.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">5. Your Rights (GDPR &amp; Worldwide)</h2>
          <p className="text-muted-foreground">
            Regardless of where you live, you have the right to:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Access the personal data we hold about you.</li>
            <li>Request correction or deletion of your data.</li>
            <li>Object to or restrict certain processing of your data.</li>
            <li>Export your data in a portable format.</li>
          </ul>
          <p className="mt-2 text-muted-foreground">
            To exercise any of these rights, contact us at{" "}
            <a
              href="mailto:yanivnavon123@gmail.com"
              className="text-blue-500 underline hover:text-blue-400"
            >
              yanivnavon123@gmail.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">6. Analytics (Future)</h2>
          <p className="text-muted-foreground">
            We may enable Google Analytics or Vercel Analytics in the future to
            understand how TierHub is used. If and when we do, we will update this
            policy and, where required by law, provide notice or obtain consent before
            those analytics collect data.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">7. Children&apos;s Privacy</h2>
          <p className="text-muted-foreground">
            TierHub is not directed at children under 13 (or the applicable age of
            digital consent in your country). We do not knowingly collect personal
            information from children. If you believe a child has provided us with
            personal data, please contact us so we can remove it.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">8. Changes to This Policy</h2>
          <p className="text-muted-foreground">
            We may update this Privacy Policy from time to time. Material changes will
            be communicated via email or a notice on the TierHub website. The
            &ldquo;Last updated&rdquo; date at the top reflects the most recent
            revision.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">9. Contact</h2>
          <p className="text-muted-foreground">
            If you have questions about this Privacy Policy or our data practices,
            reach out to{" "}
            <a
              href="mailto:yanivnavon123@gmail.com"
              className="text-blue-500 underline hover:text-blue-400"
            >
              yanivnavon123@gmail.com
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
