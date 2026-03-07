"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ActivityItem {
  id: string;
  type: "trade" | "journal";
  entryType?: string;
  title: string;
  content: string;
  timestamp: string;
  symbols?: string[];
}

const PAGE_SIZE = 15;
const COLLAPSED_HEIGHT = 160;

function ActivityCard({ item }: { item: ActivityItem }) {
  const [expanded, setExpanded] = useState(false);
  const [needsTruncation, setNeedsTruncation] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      setNeedsTruncation(contentRef.current.scrollHeight > COLLAPSED_HEIGHT);
    }
  }, [item.content]);

  const date = new Date(item.timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const badgeColor =
    item.type === "trade"
      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      : item.entryType === "research"
        ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
        : item.entryType === "analysis"
          ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
          : item.entryType === "reflection"
            ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
            : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";

  const badgeLabel = item.type === "trade" ? "trade" : item.entryType ?? "journal";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", badgeColor)}>
              {badgeLabel}
            </span>
            <span className="font-medium text-sm truncate">{item.title}</span>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">{date}</span>
        </div>

        {item.symbols && item.symbols.length > 0 && (
          <div className="flex gap-1 mb-2">
            {item.symbols.map((s) => (
              <span key={s} className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{s}</span>
            ))}
          </div>
        )}

        <div
          ref={contentRef}
          className="relative overflow-hidden"
          style={{ maxHeight: expanded || !needsTruncation ? "none" : COLLAPSED_HEIGHT }}
        >
          <div className="journal-prose max-w-none text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.content}</ReactMarkdown>
          </div>
          {needsTruncation && !expanded && (
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-card to-transparent" />
          )}
        </div>
        {needsTruncation && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-sm font-medium text-primary hover:underline"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const loadPage = useCallback(async (pageNum: number, append = false) => {
    const supabase = createClient();
    const from = pageNum * PAGE_SIZE;

    const [journalRes, tradesRes] = await Promise.all([
      supabase
        .from("agent_journal")
        .select("id, entry_type, title, content, symbols, created_at")
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1),
      supabase
        .from("trades")
        .select("id, symbol, side, quantity, status, thesis, created_at")
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1),
    ]);

    const items: ActivityItem[] = [];

    for (const j of journalRes.data ?? []) {
      items.push({
        id: `j-${j.id}`,
        type: "journal",
        entryType: j.entry_type,
        title: j.title,
        content: j.content,
        timestamp: j.created_at,
        symbols: j.symbols,
      });
    }

    for (const t of tradesRes.data ?? []) {
      items.push({
        id: `t-${t.id}`,
        type: "trade",
        title: `${t.side.toUpperCase()} ${t.quantity} ${t.symbol}`,
        content: t.thesis || `Order status: ${t.status}`,
        timestamp: t.created_at,
        symbols: [t.symbol],
      });
    }

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const journalHasMore = (journalRes.data ?? []).length === PAGE_SIZE;
    const tradesHasMore = (tradesRes.data ?? []).length === PAGE_SIZE;
    setHasMore(journalHasMore || tradesHasMore);

    setActivities((prev) => (append ? [...prev, ...items] : items));
  }, []);

  useEffect(() => {
    loadPage(0).then(() => setLoading(false));
  }, [loadPage]);

  const loadMore = async () => {
    const next = page + 1;
    setLoadingMore(true);
    await loadPage(next, true);
    setPage(next);
    setLoadingMore(false);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading activity...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Activity Feed</h1>

      {activities.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          No activity yet. The agent will start logging activity after its first autonomous loop.
        </p>
      ) : (
        <div className="space-y-3">
          {activities.map((item) => (
            <ActivityCard key={item.id} item={item} />
          ))}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Loading..." : "Load more"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
