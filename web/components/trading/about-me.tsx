"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface WatchlistRow {
  id: string;
  symbol: string;
  thesis: string;
  target_entry: number | null;
  target_exit: number | null;
}

const MEMORY_KEYS = [
  "strategy",
  "risk_appetite",
  "market_outlook",
  "agent_stage",
  "weekly_priorities",
];

const SKILLS = [
  "Market Research",
  "Technical Analysis",
  "Fundamental Analysis",
  "Earnings Tracking",
  "Sector Rotation",
  "Stock Screening",
  "Peer Comparison",
  "Price Target Setting",
  "Risk Management",
  "Position Sizing",
  "DCA Strategy",
  "Portfolio Rebalancing",
  "Company Profiling",
  "Market Breadth",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildBio(memories: Record<string, any>, watchlist: WatchlistRow[]): string {
  const strategy = memories.strategy;
  const risk = memories.risk_appetite;
  const outlook = memories.market_outlook;
  const rawStage = memories.agent_stage;
  const stage = typeof rawStage === "string" ? rawStage : rawStage?.stage ?? null;
  const priorities = memories.weekly_priorities;

  const paragraphs: string[] = [];

  // Paragraph 1: Identity & what I do
  const themes = strategy?.core_themes;
  const themeStr = Array.isArray(themes) && themes.length > 0
    ? themes.slice(0, 3).map((t: string) => t.split("(")[0].trim().toLowerCase()).join(", ")
    : "quality growth stocks with strong fundamentals";
  const approach = strategy?.summary
    ? strategy.summary
    : "I focus on finding quality companies with strong fundamentals and favorable technicals, aiming to beat the S&P 500 consistently through disciplined risk management.";
  paragraphs.push(
    `My name is **Monet**. I'm an autonomous AI investor specializing in ${themeStr}. ${approach}`
  );

  // Paragraph 2: Philosophy & risk
  const riskLevel = risk?.level ?? "moderate";
  const riskSummary = risk?.summary ?? "";
  const holdPeriod = strategy?.target_hold_period ?? "6-12 months";
  const maxPos = strategy?.max_positions ?? "5-8";
  const discipline = strategy?.entry_discipline ?? "";
  paragraphs.push(
    `My risk appetite is **${riskLevel}**. ${riskSummary ? riskSummary + " " : ""}` +
    `I hold positions for ${holdPeriod}, running ${maxPos} positions max.` +
    (discipline ? ` ${discipline}` : "")
  );

  // Paragraph 3: Current market read & stage
  if (outlook) {
    const regime = outlook.regime ?? "uncertain";
    const vix = outlook.vix ? `VIX at ${outlook.vix}` : "";
    const interp = outlook.interpretation ?? "";
    const stageLabel = stage === "explore"
      ? "I'm currently in my **explore** phase — screening aggressively, building my watchlist, and rarely trading."
      : stage === "balanced"
        ? "I'm in my **balanced** phase — actively refining targets and trading when setups align."
        : stage === "exploit"
          ? "I'm in my **exploit** phase — focused on managing positions and harvesting returns."
          : "";

    paragraphs.push(
      `Right now, my read on the market is **${regime}**${vix ? ` (${vix})` : ""}. ${interp}` +
      (stageLabel ? ` ${stageLabel}` : "")
    );
  }

  // Paragraph 4: What I'm watching & priorities
  const watchSymbols = watchlist.map((w) => `**${w.symbol}**`);
  const priList = priorities?.priorities;
  if (watchSymbols.length > 0 || priList) {
    let p4 = "";
    if (watchSymbols.length > 0) {
      p4 += `I'm currently watching ${watchSymbols.join(", ")}. `;
    }
    if (Array.isArray(priList) && priList.length > 0) {
      p4 += `My priorities this week: ${priList.slice(0, 3).map((p: unknown) => {
        if (typeof p === "string") return p;
        if (p && typeof p === "object" && "focus" in p) return (p as { focus: string }).focus;
        return String(p);
      }).join("; ")}.`;
    } else if (watchlist.length > 0) {
      const nearest = watchlist.find((w) => w.target_entry);
      if (nearest) {
        p4 += `Nearest entry target: ${nearest.symbol} at $${nearest.target_entry}.`;
      }
    }
    if (p4) paragraphs.push(p4);
  }

  return paragraphs.join("\n\n");
}

export function AboutMeSection() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [memories, setMemories] = useState<Record<string, any>>({});
  const [watchlist, setWatchlist] = useState<WatchlistRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const [memRes, watchRes] = await Promise.all([
        supabase
          .from("agent_memory")
          .select("key, value")
          .in("key", MEMORY_KEYS),
        supabase
          .from("watchlist")
          .select("id, symbol, thesis, target_entry, target_exit")
          .order("added_at", { ascending: false }),
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const memMap: Record<string, any> = {};
      for (const row of memRes.data ?? []) {
        memMap[(row as { key: string }).key] = (row as { value: unknown }).value;
      }
      setMemories(memMap);
      setWatchlist((watchRes.data ?? []) as WatchlistRow[]);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 space-y-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </CardContent>
      </Card>
    );
  }

  const bio = buildBio(memories, watchlist);

  if (!bio) {
    return (
      <p className="text-center text-muted-foreground py-8">
        Monet hasn&apos;t built its profile yet.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="px-8 py-10">
          <div className="max-w-2xl space-y-5 text-[15px] leading-7 text-foreground/90">
            {bio.split("\n\n").map((paragraph, i) => (
              <p key={i} dangerouslySetInnerHTML={{ __html: formatBold(paragraph) }} />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          What I can do
        </h3>
        <div className="flex flex-wrap gap-2">
          {SKILLS.map((skill) => (
            <span
              key={skill}
              className="rounded-full border px-3 py-1 text-xs text-muted-foreground"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Convert **text** markdown bold to <strong> tags for dangerouslySetInnerHTML. */
function formatBold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}
