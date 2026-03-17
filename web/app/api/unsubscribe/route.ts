/**
 * GET /api/unsubscribe?email=xxx
 *
 * One-click unsubscribe handler linked from the bottom of every daily recap email.
 * Sets the subscriber's status to "unsubscribed" and redirects to a confirmation page.
 *
 * No auth required — the email address itself is the identifier. This is acceptable
 * for an opt-out flow (worst case: someone unsubscribes an address they know; the
 * subscriber can re-subscribe at any time).
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[unsubscribe] Supabase env vars missing");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { error } = await supabase
    .from("email_subscriptions")
    .update({
      status: "unsubscribed",
      unsubscribed_at: new Date().toISOString(),
    })
    .eq("email", email);

  if (error) {
    console.error("[unsubscribe] DB update failed:", error.message);
    return NextResponse.json({ error: "Failed to unsubscribe" }, { status: 500 });
  }

  // Redirect to a friendly confirmation page
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return NextResponse.redirect(`${appUrl}/unsubscribed`, { status: 302 });
}
