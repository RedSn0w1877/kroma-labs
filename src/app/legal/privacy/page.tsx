// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: "How the Kroma concept site by HVNF Studios handles data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="privacy notice"
      updated="October 31, 2026"
      sections={[
        {
          heading: "what the build form does",
          body: (
            <p>
              The build form is a front-end demonstration. Your name, email address and build choices are checked in
              your browser and never sent to a server, stored or shared. Reloading the page clears them.
            </p>
          ),
        },
        {
          heading: "cookies and analytics",
          body: <p>This site sets no cookies and runs no analytics, advertising, or tracking scripts.</p>,
        },
        {
          heading: "sound",
          body: (
            <p>
              The switch sounds are synthesized in your browser with the Web Audio API. Nothing is recorded, and the
              site never asks for your microphone.
            </p>
          ),
        },
        {
          heading: "what loads from where",
          body: (
            <p>
              Everything on this site — fonts, images and code — is served from the site&apos;s own address. Nothing is
              loaded from third parties. The hosting provider keeps standard server logs (such as IP address and
              browser type) for security and performance, and handles that data under its own policy.
            </p>
          ),
        },
        {
          heading: "questions",
          body: <p>Privacy questions about this concept site can be sent to HVNF Studios through its official channels.</p>,
        },
      ]}
    />
  );
}
