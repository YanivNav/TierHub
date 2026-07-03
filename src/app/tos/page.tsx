import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "TierHub Terms of Service — rules and guidelines for using our platform.",
};

export default function TosPage() {
  return (
    <main className="mx-auto max-w-3xl flex-1 px-4 py-12 text-foreground">
      <h1 className="text-3xl font-extrabold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: July 2, 2026
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed">
        <section>
          <h2 className="mb-2 text-lg font-semibold">1. Acceptance of Terms</h2>
          <p className="text-muted-foreground">
            By accessing or using TierHub (&ldquo;the Service&rdquo;), you agree to be
            bound by these Terms of Service. If you do not agree, do not use the
            Service.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">2. Accounts</h2>
          <p className="text-muted-foreground">
            You are responsible for maintaining the confidentiality of your account
            credentials and for all activity under your account. You must provide
            accurate, current, and complete information during registration. TierHub
            reserves the right to suspend or terminate accounts that violate these
            terms.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">3. User Content</h2>
          <p className="text-muted-foreground">
            You retain ownership of the tier lists and content you create on TierHub.
            By publishing content publicly on the Service, you grant TierHub a
            worldwide, royalty-free, non-exclusive license to display and distribute
            that content through the Service.
          </p>
          <p className="mt-2 text-muted-foreground">
            You are solely responsible for the content you upload. TierHub does not
            pre-screen user content but reserves the right to remove content that
            violates these terms.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">4. Acceptable Use</h2>
          <p className="text-muted-foreground">You agree not to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              Upload content that is illegal, abusive, harassing, defamatory, or
              otherwise objectionable.
            </li>
            <li>
              Use the Service to distribute spam, malware, or unsolicited advertising.
            </li>
            <li>
              Attempt to gain unauthorized access to other users&apos; accounts or
              TierHub&apos;s systems.
            </li>
            <li>
              Use automated means (scraping, bots) to access the Service in a way that
              imposes an unreasonable load on our infrastructure.
            </li>
            <li>
              Use the AI suggestion feature to generate illegal, harmful, or
              otherwise prohibited content.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">5. Intellectual Property</h2>
          <p className="text-muted-foreground">
            The TierHub name, logo, and the Service itself (excluding user content) are
            the property of TierHub. All rights not expressly granted are reserved.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">6. Termination</h2>
          <p className="text-muted-foreground">
            You may stop using the Service and delete your account at any time. TierHub
            may suspend or terminate your access if you breach these terms, without
            prior notice and at our sole discretion.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">7. Disclaimer of Warranties</h2>
          <p className="text-muted-foreground">
            The Service is provided &ldquo;as is&rdquo; and &ldquo;as
            available,&rdquo; without warranties of any kind, express or implied.
            TierHub does not guarantee that the Service will be uninterrupted, secure,
            or error-free.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">8. Limitation of Liability</h2>
          <p className="text-muted-foreground">
            To the fullest extent permitted by law, TierHub and its operators shall not
            be liable for any indirect, incidental, special, consequential, or
            punitive damages arising from your use of the Service, including but not
            limited to loss of data, revenue, or profits.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">9. AI-Generated Content</h2>
          <p className="text-muted-foreground">
            TierHub offers AI-powered tier-list suggestions powered by third-party
            models. These suggestions are provided for convenience and may be
            inaccurate or inappropriate. You are responsible for reviewing and editing
            AI-generated content before publishing it.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">10. Changes to These Terms</h2>
          <p className="text-muted-foreground">
            We may revise these Terms of Service from time to time. Continued use of
            the Service after changes are posted constitutes acceptance of the revised
            terms. Material changes will be communicated via email or a notice on the
            website.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">11. Contact</h2>
          <p className="text-muted-foreground">
            Questions about these Terms? Contact us at{" "}
            <a
              href="mailto:contact@tier-hub.net"
              className="text-blue-500 underline hover:text-blue-400"
            >
              contact@tier-hub.net
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
