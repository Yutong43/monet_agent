create table if not exists public.email_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'unsubscribed')),
  source text not null default 'landing' check (source in ('landing', 'app')),
  subscribed_at timestamptz not null default now(),
  last_sent_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists email_subscriptions_email_key
  on public.email_subscriptions (email);

create index if not exists email_subscriptions_status_idx
  on public.email_subscriptions (status);

alter table public.email_subscriptions enable row level security;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_email_subscriptions_updated_at on public.email_subscriptions;
create trigger set_email_subscriptions_updated_at
  before update on public.email_subscriptions
  for each row execute function public.set_updated_at();
