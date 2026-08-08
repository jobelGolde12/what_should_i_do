import type { Metadata } from "next";
import { SITE_TITLE } from "@/lib/site";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: `Terms of Service`,
  description:
    "The terms that govern your use of TaskMind's text analysis tool.",
  robots: { index: true, follow: true },
};

const SECTIONS: { heading: string; body: string }[] = [
  {
    heading: "The service",
    body: "TaskMind analyzes text you provide to extract actions, deadlines, urgency, and summaries using automated rules and, when available, third-party AI models. The tool is provided for informational assistance and does not constitute professional, legal, financial, or medical advice.",
  },
  {
    heading: "Your content",
    body: "You retain ownership of the text you analyze. You are responsible for the content you submit and for ensuring you have the right to use it. Results are generated automatically and may contain errors; always verify important details yourself.",
  },
  {
    heading: "Acceptable use",
    body: "Do not use the service to process or distribute unlawful content, to attempt to disrupt or abuse the service (including automated high-volume requests), or to attempt to access accounts or data that do not belong to you.",
  },
  {
    heading: "Accounts",
    body: "Accounts are provided to sync data across your own devices. You are responsible for keeping your password confidential and for activity under your account. Provide accurate registration information and notify us of unauthorized use by deleting or securing the account.",
  },
  {
    heading: "No warranties",
    body: "The service is provided \"as is\" and \"as available\" without warranties of any kind, express or implied. We do not guarantee that the service will be uninterrupted, error-free, or that AI-generated results will be accurate.",
  },
  {
    heading: "Limitation of liability",
    body: "To the maximum extent permitted by law, we will not be liable for any indirect, incidental, consequential, special, or punitive damages, or for any loss of data, arising out of or in connection with your use of the service.",
  },
  {
    heading: "Third-party providers",
    body: "Analysis and translation may be performed by third-party providers (e.g., TokenRouter, MyMemory) subject to their own terms and privacy policies. Your text is transmitted to them only to complete the request.",
  },
  {
    heading: "Advertising",
    body: "The free service may display third-party advertisements. Ad providers may use cookies or similar technologies if you have consented; you can manage this from Settings.",
  },
  {
    heading: "Termination",
    body: "You may stop using the service at any time and delete your data from Settings. We may suspend or terminate access to the service in the event of abuse or a violation of these terms.",
  },
  {
    heading: "Changes",
    body: "We may update these terms from time to time. Continued use of the service after changes are posted constitutes acceptance of the revised terms.",
  },
];

export default function TermsPage() {
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="Terms of Service"
          kicker="Simple rules for using TaskMind responsibly."
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
