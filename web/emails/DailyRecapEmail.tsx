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

export interface Trade {
  side: string;
  quantity: number | null;
  filled_quantity: number | null;
  symbol: string;
  filled_avg_price: number | null;
  limit_price: number | null;
}

export interface DailyRecapEmailProps {
  todayLabel: string;
  portfolioEquity: number | null;
  dailyPnl: number | null;
  overallReturnPct: number | null;
  spyReturnPct: number | null;
  alphaPct: number | null;
  reflectionBody: string;
  trades: Trade[];
  unsubscribeUrl: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(val: number | null): string {
  if (val === null || val === undefined) return "N/A";
  return val.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function fmtPct(val: number | null): string {
  if (val === null || val === undefined) return "—";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(2)}%`;
}

function valColor(val: number | null): string {
  if (val === null || val === undefined) return "#111827";
  if (val > 0) return "#16a34a";
  if (val < 0) return "#dc2626";
  return "#111827";
}

function tradeLine(trade: Trade): string {
  const qty = trade.filled_quantity ?? trade.quantity;
  const price = trade.filled_avg_price ?? trade.limit_price;
  const priceText = price ? ` @ $${Number(price).toFixed(2)}` : "";
  return `${trade.side.toUpperCase()} ${qty} ${trade.symbol}${priceText}`;
}

// ── Markdown helpers ─────────────────────────────────────────────────────────

type MdNode =
  | { type: "heading"; text: string }
  | { type: "bullet"; text: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "paragraph"; text: string };

/** Parse a markdown string into typed nodes for email rendering. */
function parseMarkdown(md: string): MdNode[] {
  const lines = md.split("\n");
  const nodes: MdNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }

    // ## Heading
    if (/^#{1,3}\s/.test(line)) {
      nodes.push({ type: "heading", text: line.replace(/^#{1,3}\s+/, "") });
      i++;
      continue;
    }

    // Table block: starts with | ... |
    if (line.startsWith("|") && line.endsWith("|")) {
      const headerCells = line.split("|").slice(1, -1).map((c) => c.trim());
      // skip separator row(s)
      let j = i + 1;
      while (j < lines.length && /^\|[\s\-:|]+\|$/.test(lines[j].trim())) j++;
      const rows: string[][] = [];
      while (j < lines.length && lines[j].trim().startsWith("|") && lines[j].trim().endsWith("|")) {
        rows.push(lines[j].trim().split("|").slice(1, -1).map((c) => c.trim()));
        j++;
      }
      nodes.push({ type: "table", headers: headerCells, rows });
      i = j;
      continue;
    }

    // - bullet
    if (/^[-*]\s/.test(line)) {
      nodes.push({ type: "bullet", text: line.replace(/^[-*]\s+/, "") });
      i++;
      continue;
    }

    // Plain paragraph
    nodes.push({ type: "paragraph", text: line });
    i++;
  }

  return nodes;
}

/** Render inline markdown (**bold**) into React nodes. */
function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
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

const benchmarkBox: React.CSSProperties = {
  backgroundColor: "#111827",
  borderRadius: "16px",
  padding: "16px 18px",
  marginTop: "20px",
};

const benchmarkEyebrow: React.CSSProperties = {
  fontSize: "11px",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#9ca3af",
  margin: "0 0 10px 0",
};

const sectionLabel: React.CSSProperties = {
  fontSize: "11px",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#6b7280",
  margin: "0 0 12px 0",
};

const reflectionPara: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "1.7",
  color: "#374151",
  margin: "0 0 12px 0",
};

const mdHeading: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: "700",
  color: "#111827",
  margin: "18px 0 8px 0",
};

const mdBullet: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "1.6",
  color: "#374151",
  margin: "0 0 4px 0",
  paddingLeft: "12px",
};

const mdTableCell: React.CSSProperties = {
  fontSize: "12px",
  color: "#374151",
  padding: "4px 8px",
  borderBottom: "1px solid #e5e7eb",
};

const mdTableHeader: React.CSSProperties = {
  ...mdTableCell,
  fontWeight: "700",
  color: "#111827",
  backgroundColor: "#f9fafb",
  borderBottom: "2px solid #d1d5db",
};

const tradeListItem: React.CSSProperties = {
  fontSize: "13px",
  color: "#374151",
  margin: "0 0 4px 0",
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

export function DailyRecapEmail({
  todayLabel,
  portfolioEquity,
  dailyPnl,
  overallReturnPct,
  spyReturnPct,
  alphaPct,
  reflectionBody,
  trades,
  unsubscribeUrl,
}: DailyRecapEmailProps) {
  const reflectionNodes = parseMarkdown(
    reflectionBody || "No reflection entry was recorded today."
  );

  const topTrades = (trades ?? []).slice(0, 5);

  return (
    <Html>
      <Head />
      <Preview>Monet Daily Recap — {todayLabel}</Preview>
      <Body style={main}>
        <Container style={card}>
          {/* Header */}
          <Text style={eyebrow}>Monet daily recap</Text>
          <Text style={headline}>Executive summary for {todayLabel}</Text>
          <Text style={subheadline}>
            Your end-of-day investor brief with portfolio performance, benchmark context,
            and today&apos;s key takeaways.
          </Text>

          {/* Metric grid — 2x2 using Row/Column (table-safe) */}
          <Row>
            <Column style={{ paddingRight: "6px" }}>
              <Section style={metricCardStyle}>
                <Text style={metricLabel}>Portfolio equity</Text>
                <Text style={{ fontSize: "22px", fontWeight: "700", color: "#111827", margin: 0 }}>
                  {fmtCurrency(portfolioEquity)}
                </Text>
              </Section>
            </Column>
            <Column style={{ paddingLeft: "6px" }}>
              <Section style={metricCardStyle}>
                <Text style={metricLabel}>Daily P&amp;L</Text>
                <Text style={{ fontSize: "22px", fontWeight: "700", color: valColor(dailyPnl), margin: 0 }}>
                  {fmtCurrency(dailyPnl)}
                </Text>
              </Section>
            </Column>
          </Row>

          <Row style={{ marginTop: "12px" }}>
            <Column style={{ paddingRight: "6px" }}>
              <Section style={metricCardStyle}>
                <Text style={metricLabel}>Return</Text>
                <Text style={{ fontSize: "22px", fontWeight: "700", color: valColor(overallReturnPct), margin: 0 }}>
                  {fmtPct(overallReturnPct)}
                </Text>
              </Section>
            </Column>
            <Column style={{ paddingLeft: "6px" }}>
              <Section style={metricCardStyle}>
                <Text style={metricLabel}>Alpha vs SPY</Text>
                <Text style={{ fontSize: "22px", fontWeight: "700", color: valColor(alphaPct), margin: 0 }}>
                  {fmtPct(alphaPct)}
                </Text>
              </Section>
            </Column>
          </Row>

          {/* Benchmark */}
          <Section style={benchmarkBox}>
            <Text style={benchmarkEyebrow}>Benchmark</Text>
            <Row>
              <Column>
                <Text style={{ fontSize: "13px", color: "#9ca3af", margin: 0 }}>
                  SPY return
                </Text>
              </Column>
              <Column style={{ textAlign: "right" }}>
                <Text style={{ fontSize: "15px", fontWeight: "700", color: "#f9fafb", margin: 0 }}>
                  {fmtPct(spyReturnPct)}
                </Text>
              </Column>
            </Row>
            <Row style={{ marginTop: "8px" }}>
              <Column>
                <Text style={{ fontSize: "13px", color: "#9ca3af", margin: 0 }}>
                  Monet alpha
                </Text>
              </Column>
              <Column style={{ textAlign: "right" }}>
                <Text
                  style={{
                    fontSize: "15px",
                    fontWeight: "700",
                    color: alphaPct !== null ? valColor(alphaPct) : "#9ca3af",
                    margin: 0,
                  }}
                >
                  {fmtPct(alphaPct)}
                </Text>
              </Column>
            </Row>
          </Section>

          {/* Reflection */}
          <Hr style={{ borderColor: "#e5e7eb", margin: "24px 0 20px 0" }} />
          <Text style={sectionLabel}>Today&apos;s recap</Text>
          {reflectionNodes.map((node, i) => {
            if (node.type === "heading") {
              return <Text key={i} style={mdHeading}>{renderInline(node.text)}</Text>;
            }
            if (node.type === "bullet") {
              return <Text key={i} style={mdBullet}>&bull;&nbsp;{renderInline(node.text)}</Text>;
            }
            if (node.type === "table") {
              return (
                <table key={i} style={{ width: "100%", borderCollapse: "collapse", margin: "8px 0 12px 0" }}>
                  <thead>
                    <tr>
                      {node.headers.map((h, j) => (
                        <th key={j} style={mdTableHeader} align="left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {node.rows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci} style={mdTableCell}>{renderInline(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            }
            return <Text key={i} style={reflectionPara}>{renderInline(node.text)}</Text>;
          })}

          {/* Trades */}
          {topTrades.length > 0 && (
            <>
              <Text style={{ ...sectionLabel, marginTop: "20px" }}>
                Today&apos;s trades
              </Text>
              {topTrades.map((trade, i) => (
                <Text key={i} style={tradeListItem}>
                  &bull;&nbsp;{tradeLine(trade)}
                </Text>
              ))}
            </>
          )}

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              You&apos;re receiving this because you subscribed to Monet&apos;s daily recap.{" "}
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

export default DailyRecapEmail;
