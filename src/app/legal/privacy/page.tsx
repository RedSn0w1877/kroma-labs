// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Notice",
  description: "How the KROMA LABS concept site by HVNF Studios handles data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy notice"
      updated="September 15, 2026"
      sections={[
        {
          heading: "What the form does",
          body: (
            <p>
              The allocation request form is a front-end demonstration. Names, email addresses, regions, and build
              choices you enter are validated in your browser and never transmitted to a server, stored, or shared.
              Reloading the page clears them.
            </p>
          ),
        },
        {
          heading: "Cookies and analytics",
          body: <p>This site sets no cookies and runs no analytics, advertising, or tracking scripts.</p>,
        },
        {
          heading: "Audio",
          body: (
            <p>
              The acoustic test bench generates sound locally using your browser&apos;s Web Audio API. It does not
              access your microphone.
            </p>
          ),
        },
        {
          heading: "Third-party requests",
          body: (
            <p>
              Fonts are served from this site&apos;s own domain. The 3D scene loads a lighting environment map from a
              public content delivery network, and the hosting provider keeps standard server logs (such as IP address
              and user agent) for security and performance. Those providers handle that data under their own policies.
            </p>
          ),
        },
        {
          heading: "Questions",
          body: <p>Privacy questions about this concept site can be sent to HVNF Studios through its official channels.</p>,
        },
      ]}
    />
  );
}
