"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { JournalEntryCard } from "@/components/trading/journal-entry";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 15;

export default function JournalPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const loadEntries = useCallback(async (pageNum: number, append = false) => {
    const supabase = createClient();
    const from = pageNum * PAGE_SIZE;
    const { data } = await supabase
      .from("agent_journal")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    const rows = data ?? [];
    setHasMore(rows.length === PAGE_SIZE);
    setEntries((prev) => (append ? [...prev, ...rows] : rows));
  }, []);

  useEffect(() => {
    loadEntries(0).then(() => setLoading(false));
  }, [loadEntries]);

  const loadMore = async () => {
    const next = page + 1;
    setLoadingMore(true);
    await loadEntries(next, true);
    setPage(next);
    setLoadingMore(false);
  };

  const filterEntries = (type: string | null) =>
    type ? entries.filter((e) => e.entry_type === type) : entries;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading journal...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Agent Journal</h1>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="research">Research</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="trade">Trades</TabsTrigger>
          <TabsTrigger value="reflection">Reflections</TabsTrigger>
        </TabsList>

        {["all", "research", "analysis", "trade", "reflection"].map((tab) => {
          const filtered = filterEntries(tab === "all" ? null : tab);
          return (
            <TabsContent key={tab} value={tab} className="space-y-4">
              {filtered.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No entries yet</p>
              ) : (
                <>
                  {filtered.map((entry) => (
                    <JournalEntryCard key={entry.id} entry={entry} />
                  ))}
                  {tab === "all" && hasMore && (
                    <div className="flex justify-center pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadMore}
                        disabled={loadingMore}
                      >
                        {loadingMore ? "Loading..." : "Load more"}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
