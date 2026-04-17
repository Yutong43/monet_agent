/**
 * POST /api/email/render
 *
 * Renders the DailyRecapEmail React Email component to an HTML string.
 * Called by the Python agent at send time so the email template stays in
 * version control alongside the rest of the frontend.
 *
 * Body (JSON):
 *   todayLabel        string
 *   portfolioEquity   number | null
 *   dailyPnl          number | null
 *   overallReturnPct  number | null
 *   spyReturnPct      number | null
 *   alphaPct          number | null
 *   reflectionBody    string
 *   trades            Trade[]
 *   recipientEmail    string   — used to generate the unsubscribe link
 *
 * Returns { html: string, text: string }
 */

import { render } from "@react-email/render";
import { NextRequest, NextResponse } from "next/server";
import { DailyRecapEmail, type Trade } from "@/emails/DailyRecapEmail";
import { WeeklyCycleReportEmail, type WeeklyCycleReportEmailProps } from "@/emails/WeeklyCycleReportEmail";
import * as React from "react";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const template: string = body.template ?? "daily_recap";

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://monet.app";
    const recipientEmail: string | undefined = body.recipientEmail;
    const unsubscribeUrl = recipientEmail
      ? `${appUrl}/api/unsubscribe?email=${encodeURIComponent(recipientEmail)}`
      : `${appUrl}/unsubscribe`;

    if (template === "weekly_cycle_report") {
      return renderWeeklyCycleReport(body, unsubscribeUrl);
    }

    return renderDailyRecap(body, unsubscribeUrl);
  } catch (err) {
    console.error("[email/render] Failed to render email:", err);
    return NextResponse.json(
      { error: "Failed to render email template" },
      { status: 500 }
    );
  }
}

async function renderDailyRecap(body: Record<string, unknown>, unsubscribeUrl: string) {
  const {
    todayLabel,
    portfolioEquity,
    dailyPnl,
    overallReturnPct,
    spyReturnPct,
    alphaPct,
    reflectionBody,
    trades,
  } = body as {
    todayLabel: string;
    portfolioEquity: number | null;
    dailyPnl: number | null;
    overallReturnPct: number | null;
    spyReturnPct: number | null;
    alphaPct: number | null;
    reflectionBody: string;
    trades: Trade[];
  };

  if (!todayLabel) {
    return NextResponse.json({ error: "todayLabel is required" }, { status: 400 });
  }

  const html = await render(
    React.createElement(DailyRecapEmail, {
      todayLabel,
      portfolioEquity: portfolioEquity ?? null,
      dailyPnl: dailyPnl ?? null,
      overallReturnPct: overallReturnPct ?? null,
      spyReturnPct: spyReturnPct ?? null,
      alphaPct: alphaPct ?? null,
      reflectionBody: reflectionBody ?? "",
      trades: trades ?? [],
      unsubscribeUrl,
    })
  );

  const text = [
    `Monet Daily Recap — ${todayLabel}`,
    "",
    `Portfolio equity : ${fmt(portfolioEquity as number | null)}`,
    `Daily P&L        : ${fmt(dailyPnl as number | null)}`,
    `Return           : ${fmtPct(overallReturnPct as number | null)}`,
    `SPY return       : ${fmtPct(spyReturnPct as number | null)}`,
    `Alpha vs SPY     : ${fmtPct(alphaPct as number | null)}`,
    "",
    (reflectionBody as string) ?? "",
    "",
    "---",
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join("\n");

  return NextResponse.json({ html, text });
}

async function renderWeeklyCycleReport(body: Record<string, unknown>, unsubscribeUrl: string) {
  const props = body as unknown as Omit<WeeklyCycleReportEmailProps, "unsubscribeUrl">;

  if (!props.weekLabel) {
    return NextResponse.json({ error: "weekLabel is required" }, { status: 400 });
  }

  const html = await render(
    React.createElement(WeeklyCycleReportEmail, {
      ...props,
      unsubscribeUrl,
    })
  );

  const text = [
    `Monet AI Cycle Report — ${props.weekLabel}`,
    "",
    `Cycle Durability : ${props.cycleScore} (${props.cyclePhaseLabel})`,
    `Sector Heat      : ${props.heatScore ?? "—"} (${props.heatLevel ?? "—"})`,
    `Stack Breadth    : ${props.layersParticipating}/${props.totalLayers} layers`,
    `Infra vs SPY     : ${fmtPct(props.infraVsSpy)}`,
    `Memory vs SPY    : ${fmtPct(props.memoryVsSpy)}`,
    `Equipment vs SPY : ${fmtPct(props.equipmentVsSpy)}`,
    `Capex Signal     : ${props.capexDirection}`,
    "",
    props.cycleOutlook ?? "",
    "",
    props.agentCommentary ?? "",
    "",
    "---",
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join("\n");

  return NextResponse.json({ html, text });
}

function fmt(val: number | null): string {
  if (val === null || val === undefined) return "N/A";
  return val.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function fmtPct(val: number | null): string {
  if (val === null || val === undefined) return "—";
  return `${val > 0 ? "+" : ""}${val.toFixed(2)}%`;
}
