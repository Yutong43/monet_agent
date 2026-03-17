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
import * as React from "react";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      todayLabel,
      portfolioEquity,
      dailyPnl,
      overallReturnPct,
      spyReturnPct,
      alphaPct,
      reflectionBody,
      trades,
      recipientEmail,
    }: {
      todayLabel: string;
      portfolioEquity: number | null;
      dailyPnl: number | null;
      overallReturnPct: number | null;
      spyReturnPct: number | null;
      alphaPct: number | null;
      reflectionBody: string;
      trades: Trade[];
      recipientEmail?: string;
    } = body;

    if (!todayLabel) {
      return NextResponse.json({ error: "todayLabel is required" }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://monet.app";
    const unsubscribeUrl = recipientEmail
      ? `${appUrl}/api/unsubscribe?email=${encodeURIComponent(recipientEmail)}`
      : `${appUrl}/unsubscribe`;

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

    // Plain-text fallback (minimal — Python also builds one)
    const text = [
      `Monet Daily Recap — ${todayLabel}`,
      "",
      `Portfolio equity : ${fmt(portfolioEquity)}`,
      `Daily P&L        : ${fmt(dailyPnl)}`,
      `Return           : ${fmtPct(overallReturnPct)}`,
      `SPY return       : ${fmtPct(spyReturnPct)}`,
      `Alpha vs SPY     : ${fmtPct(alphaPct)}`,
      "",
      reflectionBody ?? "",
      "",
      "---",
      `Unsubscribe: ${unsubscribeUrl}`,
    ].join("\n");

    return NextResponse.json({ html, text });
  } catch (err) {
    console.error("[email/render] Failed to render email:", err);
    return NextResponse.json(
      { error: "Failed to render email template" },
      { status: 500 }
    );
  }
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
