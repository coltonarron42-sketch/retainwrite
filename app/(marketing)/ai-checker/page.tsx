import type { Metadata } from "next";
import { CheckerTool } from "@/components/checker/checker-tool";
import { SiteHeader } from "@/components/marketing/site-header";

export const metadata: Metadata = {
  title: "AI Detector for Student Papers: Does It Sound Like You?",
  description:
    "A signal-strength check for student drafts. It compares patterns in your writing. It does not decide who wrote the paper.",
};

export default function AiCheckerPage() {
  return (
    <main>
      <SiteHeader />
      <CheckerTool />
    </main>
  );
}
