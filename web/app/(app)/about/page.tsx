"use client";

import { AboutMeSection } from "@/components/trading/about-me";

export default function AboutPage() {
  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">About Me</h1>
      <AboutMeSection />
    </div>
  );
}
