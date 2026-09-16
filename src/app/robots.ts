// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.
// This file, its output, and every page it points to are proprietary to HVNF Studios.

import type { MetadataRoute } from "next";

// Required for static export (`output: "export"`) — this route has no dynamic input to react to.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
  };
}
