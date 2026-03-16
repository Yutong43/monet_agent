"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface WatchlistRow {
  id: string;
  symbol: string;
  thesis: string;
  target_entry: number | null;
  target_exit: number | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface FactorRanking {
  rank: number;
  symbol: string;
  sector: string;
  composite_score: number;
  momentum_score: number;
  quality_score: number;
  value_score: number;
  eps_revision_score: number;
  current_price?: number;
}

const MEMORY_KEYS = [
  "strategy",
  "risk_appetite",
  "market_outlook",
  "factor_weights",
  "factor_rankings",
];

const SKILLS_EN = [
  "Factor-Based Scoring",
  "Universe Screening (900 stocks)",
  "Momentum Factor",
  "Quality Factor",
  "Value Factor",
  "EPS Revision Tracking",
  "Earnings Intelligence",
  "Earnings Interpretation",
  "Market Breadth",
  "Sector Rotation",
  "Risk Management",
  "Position Sizing",
  "Bracket Orders",
  "Anti-Churn Controls",
  "Portfolio Rebalancing",
];

const SKILLS_ZH = [
  "因子评分系统",
  "全市场扫描 (900+股票)",
  "动量因子",
  "质量因子",
  "价值因子",
  "EPS修正追踪",
  "财报情报系统",
  "财报解读",
  "市场广度分析",
  "板块轮动",
  "风险管理",
  "仓位管理",
  "止盈止损挂单",
  "防频繁交易控制",
  "组合再平衡",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildContent(memories: Record<string, any>, watchlist: WatchlistRow[], lang: "en" | "zh") {
  const factorWeights = memories.factor_weights;
  const factorRankings = memories.factor_rankings;
  const outlook = memories.market_outlook;
  const risk = memories.risk_appetite;
  const strategy = memories.strategy;

  const mom = factorWeights?.momentum ?? 0.35;
  const qual = factorWeights?.quality ?? 0.30;
  const val = factorWeights?.value ?? 0.20;
  const eps = factorWeights?.eps_revision ?? 0.15;

  const topRankings: FactorRanking[] = factorRankings?.top_10 ?? factorRankings?.rankings ?? [];
  const riskLevel = risk?.level ?? "moderate";
  const maxPos = strategy?.max_positions ?? 8;
  const regime = outlook?.regime ?? null;
  const vix = outlook?.vix ?? null;

  if (lang === "en") {
    return {
      title: "About Monet",
      subtitle: "AI-Native Quantitative Investor",
      intro: "Monet is a fully autonomous AI trading agent that scores the entire S&P 500 + S&P 400 universe (~900 stocks) on every run, identifies the highest-ranked opportunities using a four-factor composite model, and executes trades with systematic discipline — no human in the loop.",
      howTitle: "How It Works",
      howDesc: "Every trading day, Monet runs a three-pass pipeline:",
      pass1Title: "1. Score the Universe",
      pass1Desc: `In a single pass (~75 seconds), Monet downloads price and fundamental data for ~900 stocks and ranks them on four factors:`,
      factors: [
        { name: "Momentum", weight: Math.round(mom * 100), desc: "3-month + 12-month-ex-1-month returns — price trend strength" },
        { name: "Quality", weight: Math.round(qual * 100), desc: "Profit margins, ROE, leverage — business durability" },
        { name: "Value", weight: Math.round(val * 100), desc: "Forward P/E vs sector peers — relative cheapness" },
        { name: "EPS Revision", weight: Math.round(eps * 100), desc: "Analyst estimate direction + breadth — where consensus is shifting" },
      ],
      pass2Title: "2. Enrich with Analyst Intelligence",
      pass2Desc: "For the top 20 candidates, Monet fetches real-time EPS revision data — not just whether estimates are rising or falling, but how many analysts agree. 31 analysts revising up scores far higher than 3 analysts revising up by the same amount. Breadth confirms conviction.",
      pass3Title: "3. Execute with Discipline",
      pass3Items: [
        "Composite > 80 → Market order (get the fill)",
        "Composite 70-80 → Limit order 1% below",
        "Composite 60-70 → Limit order 3% below",
        "Every position gets automatic stop-loss and take-profit brackets",
        "Anti-churn rules prevent selling positions held < 5 days",
      ],
      edgeTitle: "Where AI Has a Real Edge",
      edges: [
        { label: "Breadth", desc: "Score 900 stocks in one pass, not 3-5 deep dives" },
        { label: "Speed", desc: "React to earnings overnight, hours before analyst revisions update" },
        { label: "Discipline", desc: "No FOMO, no panic selling, no emotional attachment" },
        { label: "Consistency", desc: "Execute the same rules every time without drift" },
      ],
      llmTitle: "The LLM adds value in exactly two places:",
      llmItems: [
        "Earnings intelligence — builds persistent per-company earnings profiles that accumulate across quarters, tracking beat patterns, guidance reliability, and key business drivers. Reacts to new earnings with qualitative context hours before analyst estimates update.",
        "Risk context — distinguishing geopolitical noise from fundamental deterioration",
      ],
      llmFooter: "Everything else is deterministic Python. The system can't talk itself into a bad trade.",
      riskTitle: "Risk Controls",
      riskItems: [
        `Max ${maxPos} positions, 10% max per position, 20% cash buffer`,
        "Pre-trade risk checks on every order",
        "VIX > 30 triggers defensive mode",
        "Earnings blackout: no new positions within 5 days of earnings",
      ],
      riskLevel: `Risk appetite: ${riskLevel}`,
      regime: regime ? `Market regime: ${regime}${vix ? ` (VIX ${vix})` : ""}` : null,
      rankingsTitle: "Current Top Rankings",
      topRankings,
      watchlist,
      skillsTitle: "Capabilities",
      skills: SKILLS_EN,
    };
  }

  // Chinese
  return {
    title: "关于 Monet",
    subtitle: "AI原生量化投资系统",
    intro: "Monet 是一个完全自主的AI交易代理，每次运行扫描整个标普500和标普400（约900只股票），使用四因子复合模型识别排名最高的投资机会，并以系统化的纪律执行交易 — 全程无需人工干预。",
    howTitle: "运作方式",
    howDesc: "每个交易日，Monet 运行三阶段流水线：",
    pass1Title: "1. 全市场评分",
    pass1Desc: "单次扫描（约75秒），Monet下载约900只股票的价格和基本面数据，按四个因子进行排名：",
    factors: [
      { name: "动量", weight: Math.round(mom * 100), desc: "3个月 + 12个月（去掉近1个月）收益率 — 价格趋势强度" },
      { name: "质量", weight: Math.round(qual * 100), desc: "利润率、ROE、杠杆率 — 业务可持续性" },
      { name: "价值", weight: Math.round(val * 100), desc: "远期市盈率 vs 同行业 — 相对便宜程度" },
      { name: "EPS修正", weight: Math.round(eps * 100), desc: "分析师预估方向 + 广度 — 市场共识的变化方向" },
    ],
    pass2Title: "2. 分析师情报增强",
    pass2Desc: "对排名前20的候选股票，Monet获取实时EPS修正数据 — 不仅看预估是升还是降，还看有多少分析师达成共识。31位分析师一致上调的评分远高于3位分析师上调同等幅度。广度确认信念强度。",
    pass3Title: "3. 纪律化执行",
    pass3Items: [
      "综合评分 > 80 → 市价单（确保成交）",
      "综合评分 70-80 → 限价单（低于现价1%）",
      "综合评分 60-70 → 限价单（低于现价3%）",
      "每个仓位自动设置止盈止损挂单",
      "防频繁交易规则：持仓不足5天不卖出",
    ],
    edgeTitle: "AI的真正优势",
    edges: [
      { label: "广度", desc: "一次扫描900只股票，而非深度分析3-5只" },
      { label: "速度", desc: "财报发布后数小时内反应，远早于分析师修正" },
      { label: "纪律", desc: "不追涨、不恐慌抛售、不情感依附" },
      { label: "一致性", desc: "每次严格执行相同规则，不会偏离" },
    ],
    llmTitle: "大语言模型在两个关键环节发挥价值：",
    llmItems: [
      "财报情报 — 为每家公司建立持续累积的财报档案，跟踪超预期模式、业绩指引可靠性和关键业务驱动因素。在分析师更新预估前数小时结合定性背景做出反应。",
      "风险情境判断 — 区分地缘政治噪音与基本面恶化",
    ],
    llmFooter: "其余一切都是确定性的Python计算。系统不会自我说服做出错误交易。",
    riskTitle: "风险控制",
    riskItems: [
      `最多${maxPos}个仓位，单仓不超过10%，20%现金缓冲`,
      "每笔交易前进行风控检查",
      "VIX > 30 触发防御模式",
      "财报静默期：财报前5天内不建新仓",
    ],
    riskLevel: `风险偏好：${riskLevel === "moderate" ? "稳健" : riskLevel === "aggressive" ? "激进" : "保守"}`,
    regime: regime ? `市场状态：${regime}${vix ? `（VIX ${vix}）` : ""}` : null,
    rankingsTitle: "当前排名前列",
    topRankings,
    watchlist,
    skillsTitle: "能力模块",
    skills: SKILLS_ZH,
  };
}

export function AboutMeSection() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [memories, setMemories] = useState<Record<string, any>>({});
  const [watchlist, setWatchlist] = useState<WatchlistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<"en" | "zh">("en");

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
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </CardContent>
      </Card>
    );
  }

  const c = buildContent(memories, watchlist, lang);

  return (
    <div className="space-y-6">
      {/* Language toggle */}
      <div className="flex justify-end">
        <div className="inline-flex rounded-lg border p-0.5 text-xs">
          <button
            onClick={() => setLang("en")}
            className={cn(
              "rounded-md px-3 py-1 transition-colors",
              lang === "en" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            )}
          >
            EN
          </button>
          <button
            onClick={() => setLang("zh")}
            className={cn(
              "rounded-md px-3 py-1 transition-colors",
              lang === "zh" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            )}
          >
            CN
          </button>
        </div>
      </div>

      {/* Main content */}
      <Card>
        <CardContent className="px-8 py-10">
          <div className="max-w-2xl space-y-8 text-[15px] leading-7 text-foreground/90">
            {/* Header */}
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{c.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">{c.subtitle}</p>
            </div>

            {/* Intro */}
            <p>{c.intro}</p>

            {/* How it works */}
            <div className="space-y-5">
              <h2 className="text-lg font-semibold">{c.howTitle}</h2>
              <p className="text-muted-foreground text-sm">{c.howDesc}</p>

              {/* Pass 1: Score */}
              <div className="space-y-3">
                <h3 className="font-semibold">{c.pass1Title}</h3>
                <p className="text-sm text-muted-foreground">{c.pass1Desc}</p>
                <div className="grid gap-2">
                  {c.factors.map((f) => (
                    <div key={f.name} className="flex items-start gap-3 text-sm">
                      <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums">
                        {f.weight}%
                      </span>
                      <div>
                        <span className="font-medium">{f.name}</span>
                        <span className="text-muted-foreground"> — {f.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pass 2: Enrich */}
              <div className="space-y-2">
                <h3 className="font-semibold">{c.pass2Title}</h3>
                <p className="text-sm">{c.pass2Desc}</p>
              </div>

              {/* Pass 3: Execute */}
              <div className="space-y-2">
                <h3 className="font-semibold">{c.pass3Title}</h3>
                <ul className="text-sm space-y-1">
                  {c.pass3Items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-muted-foreground mt-1.5 shrink-0">-</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* AI Edge */}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">{c.edgeTitle}</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {c.edges.map((e) => (
                  <div key={e.label} className="rounded-lg border p-3">
                    <p className="text-sm font-semibold">{e.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{e.desc}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2 mt-3">
                <p className="text-sm font-medium">{c.llmTitle}</p>
                <ul className="text-sm space-y-1">
                  {c.llmItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-muted-foreground mt-1.5 shrink-0">-</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground italic">{c.llmFooter}</p>
              </div>
            </div>

            {/* Risk Controls */}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">{c.riskTitle}</h2>
              <ul className="text-sm space-y-1">
                {c.riskItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-muted-foreground mt-1.5 shrink-0">-</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border px-3 py-1">{c.riskLevel}</span>
                {c.regime && <span className="rounded-full border px-3 py-1">{c.regime}</span>}
              </div>
            </div>

            {/* Top Rankings */}
            {c.topRankings.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">{c.rankingsTitle}</h2>
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="pb-1.5 text-left font-medium">#</th>
                        <th className="pb-1.5 text-left font-medium">Symbol</th>
                        <th className="pb-1.5 text-left font-medium">Sector</th>
                        <th className="pb-1.5 text-right font-medium">Composite</th>
                        <th className="pb-1.5 text-right font-medium">Mom</th>
                        <th className="pb-1.5 text-right font-medium">Qual</th>
                        <th className="pb-1.5 text-right font-medium">Val</th>
                        <th className="pb-1.5 text-right font-medium">EPS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.topRankings.slice(0, 10).map((r: FactorRanking) => (
                        <tr key={r.symbol} className="border-b last:border-0">
                          <td className="py-1.5 text-muted-foreground">{r.rank}</td>
                          <td className="py-1.5 font-semibold">{r.symbol}</td>
                          <td className="py-1.5 text-muted-foreground">{r.sector}</td>
                          <td className={cn(
                            "py-1.5 text-right font-semibold",
                            r.composite_score >= 80 ? "text-green-600" : r.composite_score >= 70 ? "text-yellow-600" : ""
                          )}>
                            {r.composite_score?.toFixed(1)}
                          </td>
                          <td className="py-1.5 text-right">{r.momentum_score?.toFixed(0)}</td>
                          <td className="py-1.5 text-right">{r.quality_score?.toFixed(0)}</td>
                          <td className="py-1.5 text-right">{r.value_score?.toFixed(0)}</td>
                          <td className={cn(
                            "py-1.5 text-right",
                            r.eps_revision_score >= 70 ? "text-green-600" : r.eps_revision_score <= 30 ? "text-red-500" : ""
                          )}>
                            {r.eps_revision_score?.toFixed(0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Skills */}
      <div className="px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          {c.skillsTitle}
        </h3>
        <div className="flex flex-wrap gap-2">
          {c.skills.map((skill) => (
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
