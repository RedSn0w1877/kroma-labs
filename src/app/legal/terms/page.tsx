// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "Terms for the Kroma concept site by HVNF Studios.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="terms of use"
      updated="October 31, 2026"
      sections={[
        {
          heading: "concept project",
          body: (
            <p>
              This website is a portfolio demonstration created by HVNF Studios. Kroma is a fictional brand. No
              products are manufactured, offered for sale or shipped, and no contract is formed by using any part of
              this site, including the build form.
            </p>
          ),
        },
        {
          heading: "ownership",
          body: (
            <p>
              All source code, visual design, rendered images, audio synthesis logic, written copy and brand marks on
              this site are © 2026 HVNF Studios. All rights reserved.
            </p>
          ),
        },
        {
          heading: "permitted use",
          body: (
            <>
              <p>You may view this site in a web browser for personal evaluation of HVNF Studios&apos; work.</p>
              <p>
                You may not copy, redistribute, republish, resell, frame, scrape, or reuse any part of this site or its
                code, including as a template, in client work, or in datasets used to train software, without written
                permission from HVNF Studios.
              </p>
            </>
          ),
        },
        {
          heading: "illustrative information",
          body: (
            <p>
              Specifications, tolerances, prices and shipping times are illustrative and do not describe a real
              product. The site is provided as-is, without warranties of any kind.
            </p>
          ),
        },
        {
          heading: "contact",
          body: <p>Licensing and project enquiries should be directed to HVNF Studios through its official channels.</p>,
        },
      ]}
    />
  );
}
