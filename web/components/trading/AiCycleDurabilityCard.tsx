"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface LayerDetail {
  return_3m_pct: number | null;
  vs_spy_pct: number | null;
  participating: boolean;
}

interface AiCycleDurabilityData {
  score: number;
  phase: string;
  phase_label: string;
  outlook: string;
  spy_return_3m_pct: number;
  signals: {
    stack_breadth: {
      score: number;
      layers_participating: number;
      total_layers: number;
      layers: Record<string, LayerDetail>;
    };
    infra_momentum: { score: number; vs_spy_pct: number };
    memory_demand: { score: number; vs_spy_pct: number };
    equipment_demand: { score: number; vs_spy_pct: number };
    capex_signal: { score: number; direction: string };
  };
  as_of: string;
}

function phaseColor(phase: string) {
  switch (phase) {
    case "full_build": return "text-green-500";
    case "expanding":  return "text-emerald-500";
    case "maturing":   return "text-yellow-500";
    case "cooling":    return "text-red-500";
    default:           return "text-muted-foreground";
  }
}

function fmtVsSpy(val: number | null): string {
  if (val === null) return "N/A";
  const sign = val >= 0 ? "+" : "";
  return `${sign}${val.toFixed(1)}%`;
}

function capexLabel(dir: string): string {
  switch (dir) {
    case "accelerating": return "Accelerating";
    case "stable":       return "Stable";
    case "decelerating": return "Decelerating";
    default:             return "Pending";
  }
}

function capexColor(dir: string): string {
  switch (dir) {
    case "accelerating": return "text-green-500";
    case "stable":       return "text-yellow-500";
    case "decelerating": return "text-red-500";
    default:             return "text-muted-foreground";
  }
}

export function AiCycleDurabilityCard() {
  const [data, setData] = useState<AiCycleDurabilityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: row } = await supabase
        .from("agent_memory")
        .select("value")
        .eq("key", "ai_cycle_durability")
        .maybeSingle();

      if (row?.value) {
        setData(row.value as AiCycleDurabilityData);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex flex-col gap-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-6 flex flex-col gap-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
            AI Cycle Durability
          </p>
          <p className="text-muted-foreground text-sm mt-2">No data yet — runs after next weekly review.</p>
        </CardContent>
      </Card>
    );
  }

  const asOf = data.as_of
    ? new Date(data.as_of).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null;

  const s = data.signals;

  return (
    <Card>
      <CardContent className="p-6 flex flex-col gap-3">
        {/* Eyebrow */}
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
          AI Cycle Durability
        </p>

        {/* Score + Phase */}
        <div className="flex items-end gap-2">
          <span className={cn("text-4xl font-bold tabular-nums leading-none", phaseColor(data.phase))}>
            {data.score}
          </span>
          <span className={cn("text-sm font-semibold mb-0.5", phaseColor(data.phase))}>
            {data.phase_label}
          </span>
        </div>

        {/* Sub-rows */}
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Stack breadth</span>
            <span className={cn("font-medium tabular-nums", s.stack_breadth.layers_participating >= 4 ? "text-green-500" : s.stack_breadth.layers_participating <= 2 ? "text-orange-500" : "")}>
              {s.stack_breadth.layers_participating}/{s.stack_breadth.total_layers} layers
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Infra momentum</span>
            <span className={cn("font-medium tabular-nums", s.infra_momentum.vs_spy_pct > 10 ? "text-green-500" : s.infra_momentum.vs_spy_pct < 0 ? "text-orange-500" : "")}>
              {fmtVsSpy(s.infra_momentum.vs_spy_pct)} vs SPY
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Memory demand</span>
            <span className={cn("font-medium tabular-nums", s.memory_demand.vs_spy_pct > 10 ? "text-green-500" : s.memory_demand.vs_spy_pct < 0 ? "text-orange-500" : "")}>
              {fmtVsSpy(s.memory_demand.vs_spy_pct)} vs SPY
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Equipment demand</span>
            <span className={cn("font-medium tabular-nums", s.equipment_demand.vs_spy_pct > 10 ? "text-green-500" : s.equipment_demand.vs_spy_pct < 0 ? "text-orange-500" : "")}>
              {fmtVsSpy(s.equipment_demand.vs_spy_pct)} vs SPY
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Capex signal</span>
            <span className={cn("font-medium", capexColor(s.capex_signal.direction))}>
              {capexLabel(s.capex_signal.direction)}
            </span>
          </div>
        </div>

        {/* Footer timestamp */}
        {asOf && (
          <p className="text-xs text-muted-foreground border-t pt-2 mt-1">
            Updated {asOf}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
