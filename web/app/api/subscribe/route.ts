import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SubscribePayload = {
  email?: unknown;
  source?: unknown;
};

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeSource(value: unknown): "landing" | "app" {
  return value === "app" ? "app" : "landing";
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as SubscribePayload | null;
  const email = normalizeEmail(body?.email);
  const source = normalizeSource(body?.source);

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const payload: {
    email: string;
    source: "landing" | "app";
    status: "active";
    subscribed_at: string;
    unsubscribed_at: null;
    user_id?: string;
  } = {
    email,
    source,
    status: "active",
    subscribed_at: new Date().toISOString(),
    unsubscribed_at: null,
  };

  if (user?.id) {
    payload.user_id = user.id;
  }

  const { error } = await admin
    .from("email_subscriptions")
    .upsert(payload, { onConflict: "email" });

  if (error) {
    return NextResponse.json({ error: "Could not save your subscription." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "You're subscribed. Monet will send the daily recap to your inbox.",
  });
}
