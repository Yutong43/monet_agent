import {
  Body,
  Column,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface LayerDetail {
  return_3m_pct: number | null;
  vs_spy_pct: number | null;
  participating: boolean;
}

export interface WeeklyCycleReportEmailProps {
  weekLabel: string;
  // Cycle durability
  cycleScore: number;
  cyclePhaseLabel: string;
  cycleOutlook: string;
  layersParticipating: number;
  totalLayers: number;
  layers: Record<string, LayerDetail>;
  infraVsSpy: number | null;
  memoryVsSpy: number | null;
  equipmentVsSpy: number | null;
  capexDirection: string;
  spyReturn3m: number | null;
  // Sector heat (companion context)
  heatScore: number | null;
  heatLevel: string | null;
  // Week-over-week changes
  prevCycleScore: number | null;
  // Commentary from agent
  agentCommentary: string;
  unsubscribeUrl: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtPct(val: number | null): string {
  if (val === null || val === undefined) return "—";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(1)}%`;
}

function phaseColor(phase: string): string {
  if (phase.toLowerCase().includes("full build")) return "#16a34a";
  if (phase.toLowerCase().includes("expanding")) return "#10b981";
  if (phase.toLowerCase().includes("maturing")) return "#eab308";
  if (phase.toLowerCase().includes("cooling")) return "#dc2626";
  return "#6b7280";
}

function heatColor(level: string | null): string {
  switch (level) {
    case "low":       return "#16a34a";
    case "moderate":  return "#eab308";
    case "elevated":  return "#f97316";
    case "high":      return "#dc2626";
    default:          return "#6b7280";
  }
}

function capexLabel(dir: string): string {
  switch (dir) {
    case "accelerating": return "Accelerating";
    case "stable":       return "Stable";
    case "decelerating": return "Decelerating";
    default:             return "Pending Update";
  }
}

function capexColor(dir: string): string {
  switch (dir) {
    case "accelerating": return "#16a34a";
    case "stable":       return "#eab308";
    case "decelerating": return "#dc2626";
    default:             return "#6b7280";
  }
}

function deltaLabel(current: number, prev: number | null): string {
  if (prev === null) return "—";
  const diff = current - prev;
  const sign = diff > 0 ? "+" : "";
  return `${sign}${diff} from last week`;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const main: React.CSSProperties = {
  backgroundColor: "#f4f1ea",
  fontFamily: "Arial, sans-serif",
  padding: "28px 0",
};

const card: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #e7e0d2",
  borderRadius: "24px",
  padding: "28px",
  maxWidth: "600px",
  margin: "0 auto",
};

const eyebrow: React.CSSProperties = {
  fontSize: "11px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#6b7280",
  margin: "0 0 8px 0",
};

const headline: React.CSSProperties = {
  fontSize: "26px",
  lineHeight: "1.2",
  color: "#111827",
  fontWeight: "700",
  margin: "0 0 8px 0",
};

const subheadline: React.CSSProperties = {
  fontSize: "14px",
  color: "#6b7280",
  lineHeight: "1.6",
  margin: "0 0 20px 0",
};

const metricCardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: "14px",
  padding: "14px 16px",
  backgroundColor: "#fafaf9",
};

const metricLabel: React.CSSProperties = {
  fontSize: "11px",
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  margin: "0 0 6px 0",
};

const sectionLabel: React.CSSProperties = {
  fontSize: "11px",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#6b7280",
  margin: "0 0 12px 0",
};

const tableCell: React.CSSProperties = {
  fontSize: "13px",
  color: "#374151",
  padding: "8px 10px",
  borderBottom: "1px solid #f3f4f6",
};

const tableHeader: React.CSSProperties = {
  ...tableCell,
  fontWeight: "700",
  color: "#111827",
  backgroundColor: "#f9fafb",
  borderBottom: "2px solid #e5e7eb",
  fontSize: "11px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
};

const commentaryPara: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "1.7",
  color: "#374151",
  margin: "0 0 12px 0",
};

const footer: React.CSSProperties = {
  textAlign: "center",
  marginTop: "28px",
  paddingTop: "16px",
  borderTop: "1px solid #e5e7eb",
};

const footerText: React.CSSProperties = {
  fontSize: "12px",
  color: "#9ca3af",
  margin: "0",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function WeeklyCycleReportEmail({
  weekLabel,
  cycleScore,
  cyclePhaseLabel,
  cycleOutlook,
  layersParticipating,
  totalLayers,
  layers,
  infraVsSpy,
  memoryVsSpy,
  equipmentVsSpy,
  capexDirection,
  spyReturn3m,
  heatScore,
  heatLevel,
  prevCycleScore,
  agentCommentary,
  unsubscribeUrl,
}: WeeklyCycleReportEmailProps) {
  const layerNames = Object.keys(layers || {});
  const commentaryLines = (agentCommentary || "").split("\n").filter((l) => l.trim());

  return (
    <Html>
      <Head />
      <Preview>Monet AI Cycle Report — {weekLabel}</Preview>
      <Body style={main}>
        <Container style={card}>
          {/* Header */}
          <Text style={eyebrow}>Monet weekly cycle report</Text>
          <Text style={headline}>AI Capex Cycle Status</Text>
          <Text style={subheadline}>
            Week of {weekLabel} — Where we are in the AI infrastructure buildout cycle,
            with data-driven signals and actionable outlook.
          </Text>

          {/* Hero metrics: Cycle Score + Heat Score side by side */}
          <Row>
            <Column style={{ paddingRight: "6px" }}>
              <Section style={metricCardStyle}>
                <Text style={metricLabel}>Cycle durability</Text>
                <Text style={{ fontSize: "32px", fontWeight: "700", color: phaseColor(cyclePhaseLabel), margin: "0 0 4px 0" }}>
                  {cycleScore}
                </Text>
                <Text style={{ fontSize: "13px", fontWeight: "600", color: phaseColor(cyclePhaseLabel), margin: 0 }}>
                  {cyclePhaseLabel}
                </Text>
                {prevCycleScore !== null && (
                  <Text style={{ fontSize: "11px", color: "#9ca3af", margin: "4px 0 0 0" }}>
                    {deltaLabel(cycleScore, prevCycleScore)}
                  </Text>
                )}
              </Section>
            </Column>
            <Column style={{ paddingLeft: "6px" }}>
              <Section style={metricCardStyle}>
                <Text style={metricLabel}>Sector heat</Text>
                <Text style={{ fontSize: "32px", fontWeight: "700", color: heatColor(heatLevel), margin: "0 0 4px 0" }}>
                  {heatScore ?? "—"}
                </Text>
                <Text style={{ fontSize: "13px", fontWeight: "600", color: heatColor(heatLevel), margin: 0 }}>
                  {heatLevel ? heatLevel.charAt(0).toUpperCase() + heatLevel.slice(1) : "—"}
                </Text>
                <Text style={{ fontSize: "11px", color: "#9ca3af", margin: "4px 0 0 0" }}>
                  SPY 3-month: {fmtPct(spyReturn3m)}
                </Text>
              </Section>
            </Column>
          </Row>

          {/* Outlook */}
          <Section style={{ backgroundColor: "#111827", borderRadius: "16px", padding: "16px 18px", marginTop: "20px" }}>
            <Text style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#9ca3af", margin: "0 0 8px 0" }}>
              Outlook
            </Text>
            <Text style={{ fontSize: "14px", lineHeight: "1.6", color: "#f9fafb", margin: 0 }}>
              {cycleOutlook}
            </Text>
          </Section>

          {/* Signal Breakdown */}
          <Hr style={{ borderColor: "#e5e7eb", margin: "24px 0 20px 0" }} />
          <Text style={sectionLabel}>Signal Breakdown</Text>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={tableHeader} align="left">Signal</th>
                <th style={tableHeader} align="right">Value</th>
                <th style={tableHeader} align="right">Pts</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tableCell}>Stack breadth</td>
                <td style={{ ...tableCell, textAlign: "right", fontWeight: "600" }}>
                  {layersParticipating}/{totalLayers} layers
                </td>
                <td style={{ ...tableCell, textAlign: "right" }}>{layersParticipating * 4}/20</td>
              </tr>
              <tr>
                <td style={tableCell}>Infra momentum</td>
                <td style={{ ...tableCell, textAlign: "right", fontWeight: "600", color: (infraVsSpy ?? 0) >= 0 ? "#16a34a" : "#dc2626" }}>
                  {fmtPct(infraVsSpy)} vs SPY
                </td>
                <td style={{ ...tableCell, textAlign: "right" }}>/20</td>
              </tr>
              <tr>
                <td style={tableCell}>Memory demand</td>
                <td style={{ ...tableCell, textAlign: "right", fontWeight: "600", color: (memoryVsSpy ?? 0) >= 0 ? "#16a34a" : "#dc2626" }}>
                  {fmtPct(memoryVsSpy)} vs SPY
                </td>
                <td style={{ ...tableCell, textAlign: "right" }}>/20</td>
              </tr>
              <tr>
                <td style={tableCell}>Equipment demand</td>
                <td style={{ ...tableCell, textAlign: "right", fontWeight: "600", color: (equipmentVsSpy ?? 0) >= 0 ? "#16a34a" : "#dc2626" }}>
                  {fmtPct(equipmentVsSpy)} vs SPY
                </td>
                <td style={{ ...tableCell, textAlign: "right" }}>/20</td>
              </tr>
              <tr>
                <td style={{ ...tableCell, borderBottom: "none" }}>Capex signal</td>
                <td style={{ ...tableCell, borderBottom: "none", textAlign: "right", fontWeight: "600", color: capexColor(capexDirection) }}>
                  {capexLabel(capexDirection)}
                </td>
                <td style={{ ...tableCell, borderBottom: "none", textAlign: "right" }}>/20</td>
              </tr>
            </tbody>
          </table>

          {/* Layer-by-Layer Breakdown */}
          <Hr style={{ borderColor: "#e5e7eb", margin: "20px 0" }} />
          <Text style={sectionLabel}>Stack Layer Detail</Text>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={tableHeader} align="left">Layer</th>
                <th style={tableHeader} align="right">3M Return</th>
                <th style={tableHeader} align="right">vs SPY</th>
                <th style={tableHeader} align="center">Status</th>
              </tr>
            </thead>
            <tbody>
              {layerNames.map((name) => {
                const layer = layers[name];
                return (
                  <tr key={name}>
                    <td style={tableCell}>{name}</td>
                    <td style={{ ...tableCell, textAlign: "right" }}>
                      {layer.return_3m_pct !== null ? `${layer.return_3m_pct.toFixed(1)}%` : "—"}
                    </td>
                    <td style={{ ...tableCell, textAlign: "right", color: (layer.vs_spy_pct ?? 0) >= 0 ? "#16a34a" : "#dc2626" }}>
                      {fmtPct(layer.vs_spy_pct)}
                    </td>
                    <td style={{ ...tableCell, textAlign: "center" }}>
                      {layer.participating ? "Active" : "Lagging"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Agent Commentary */}
          {commentaryLines.length > 0 && (
            <>
              <Hr style={{ borderColor: "#e5e7eb", margin: "20px 0" }} />
              <Text style={sectionLabel}>Monet&apos;s Take</Text>
              {commentaryLines.map((line, i) => (
                <Text key={i} style={commentaryPara}>
                  {line.startsWith("- ") ? <>&bull;&nbsp;{line.slice(2)}</> : line}
                </Text>
              ))}
            </>
          )}

          {/* Data Sources */}
          <Hr style={{ borderColor: "#e5e7eb", margin: "20px 0" }} />
          <Text style={{ ...sectionLabel, color: "#9ca3af" }}>Data Sources</Text>
          <Text style={{ fontSize: "11px", color: "#9ca3af", lineHeight: "1.6", margin: 0 }}>
            Stack returns: Yahoo Finance 3-month price data for SMH, MU, ETN, VRT, VST, AMAT, LRCX, KLAC, ANET, CSCO, and AI compute basket.
            Capex signal: Hyperscaler earnings guidance (MSFT, GOOG, AMZN, META) — updated quarterly.
            Sector heat: SMH RSI/200MA, AI basket breadth, NVDA forward P/E.
          </Text>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              You&apos;re receiving this because you subscribed to Monet&apos;s weekly cycle report.{" "}
              <Link href={unsubscribeUrl} style={{ color: "#6b7280" }}>
                Unsubscribe
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default WeeklyCycleReportEmail;
