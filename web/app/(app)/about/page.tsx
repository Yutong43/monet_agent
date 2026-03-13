"use client";

import { AboutMeSection } from "@/components/trading/about-me";
import { ReleaseLog } from "@/components/trading/release-log";

export default function AboutPage() {
  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <AboutMeSection />
        <div className="lg:sticky lg:top-6 lg:self-start">
          <ReleaseLog />
        </div>
      </div>
    </div>
  );
}
