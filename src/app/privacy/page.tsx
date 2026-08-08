import type { Metadata } from "next";
import { SITE_TITLE } from "@/lib/site";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: `Privacy Policy`,
  description:
    "How TaskMind handles your data: local-first storage, what is sent to AI providers, and how share links work.",
  robots: { index: true, follow: true },
};

const SECTIONS: { heading: string; body: string }[] = [
  {
    heading: "Local-first storage",
    body: "Your analyses, templates, actions board, and settings are stored in your browser's local storage on your device. They are not uploaded to us or saved on our servers unless you sign in and choose to sync.",
  },
  {
    heading: "What is sent to AI providers",
    body: "When you analyze text, that text is transmitted to the configured AI provider (for example TokenRouter) solely to generate the analysis: extracted actions, deadlines, urgency, and a summary. The provider receives your text once; the results are then stored locally on your device. We do not retain or log the text you analyze beyond the request itself.",
  },
  {
    heading: "Translation",
    body: "If you translate a summary, the summary text is sent to the translation provider to produce the translation. The same local-first rule applies: only the text you explicitly ask to translate is transmitted.",
  },
  {
    heading: "Share links",
    body: "Share links embed the full analysis — including the raw input unless you exclude it or mark it sensitive — directly in the URL using reversible encoding. Anyone with the link can decode it. Links are not encrypted, do not expire, and are not stored on our servers. Do not share links containing sensitive information.",
  },
  {
    heading: "Account data",
    body: "If you create an account, your email address and a securely hashed password are stored to authenticate you, and your synced data (history, templates, board) is associated with that account so you can merge it on another device. You can back up, merge, or delete all of this data at any time from Settings, and deleting your account erases the data we hold about you.",
  },
  {
    heading: "Advertising",
    body: "Advertisements on this site are served by third-party providers (such as Google AdSense) only if you have consented to non-essential cookies and if the site is configured for ads. You can withdraw consent at any time from Settings.",
  },
  {
    heading: "Cookies & sessions",
    body: "We use a small number of strictly-necessary cookies: a theme preference and, when signed in, a secure session cookie for authentication. No analytics or tracking cookies are used.",
  },
  {
    heading: "Security",
    body: "Passwords are hashed with a slow, salted hash (scrypt) and never stored in plain text. Sessions use signed, HttpOnly, SameSite cookies that expire after 30 days. Public endpoints are rate-limited to discourage abuse. Despite these measures, no method of transmission or storage is completely secure, and you use the service at your own risk.",
  },
  {
    heading: "Data retention & your rights",
    body: "Local data stays on your device until you clear it. Account data can be exported or erased at any time from Settings; account deletion permanently removes your user record and synced data. To exercise any data rights, use the account controls in Settings.",
  },
  {
    heading: "Changes",
    body: "We may update this policy as features evolve. Material changes will be reflected here, and continued use after changes constitutes acceptance.",
  },
];

export default function PrivacyPage() {
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="Privacy Policy"
          kicker="Local-first by default. Your text, your device."
        />
        <div className="space-y-6">
          {SECTIONS.map((section) => (
            <section key={section.heading}>
              <h2 className="font-display text-base font-medium text-ink">
                {section.heading}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                {section.body}
              </p>
            </section>
          ))}
          <p className="border-t border-line pt-4 font-mono text-xxs uppercase tracking-label text-muted">
            {SITE_TITLE} · Last updated August 2026
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
