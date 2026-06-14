-- ============================================================
-- VST GOD — Supabase Database Migration
-- Run this in your Supabase SQL Editor after creating a project.
-- https://supabase.com/dashboard → SQL Editor → New Query
-- ============================================================

-- ── User profiles extending Supabase auth ───────────────────
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  email text unique not null,
  role text default 'user' check (role in ('user', 'beta_pending', 'beta', 'customer', 'admin')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Beta signup waitlist (from marketing site) ──────────────
create table if not exists beta_signups (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  source text default 'website',
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  invited_at timestamptz,
  created_at timestamptz default now()
);

-- ── One-time purchases ──────────────────────────────────────
create table if not exists purchases (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete set null,
  stripe_payment_intent_id text unique,
  stripe_checkout_session_id text,
  amount_cents int not null,
  currency text default 'usd',
  status text default 'completed' check (status in ('pending', 'completed', 'refunded', 'failed')),
  created_at timestamptz default now()
);

-- ── License keys ────────────────────────────────────────────
create table if not exists license_keys (
  id uuid default gen_random_uuid() primary key,
  key text unique not null,
  user_id uuid references profiles(id) on delete set null,
  type text not null check (type in ('beta', 'purchase', 'promo')),
  status text default 'active' check (status in ('active', 'revoked', 'expired')),
  max_activations int default 2,
  current_activations int default 0,
  purchase_id uuid references purchases(id) on delete set null,
  created_at timestamptz default now(),
  expires_at timestamptz
);

-- ── License activations (machine tracking) ──────────────────
create table if not exists license_activations (
  id uuid default gen_random_uuid() primary key,
  license_id uuid references license_keys(id) on delete cascade,
  machine_id text not null,
  platform text not null check (platform in ('macos', 'windows')),
  plugin_version text,
  activated_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  unique(license_id, machine_id)
);

-- ── Plugin releases ─────────────────────────────────────────
create table if not exists plugin_releases (
  id uuid default gen_random_uuid() primary key,
  version text unique not null,
  release_notes text,
  macos_vst3_path text,
  macos_au_path text,
  macos_standalone_path text,
  windows_vst3_path text,
  is_beta boolean default true,
  is_latest boolean default false,
  released_at timestamptz default now()
);

-- ── Download tracking ───────────────────────────────────────
create table if not exists downloads (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete set null,
  license_id uuid references license_keys(id) on delete set null,
  plugin_version text not null,
  platform text not null check (platform in ('macos', 'windows')),
  format text not null check (format in ('vst3', 'au', 'standalone', 'bundle')),
  ip_address inet,
  downloaded_at timestamptz default now()
);


-- ============================================================
-- Row Level Security (RLS) Policies
-- ============================================================

-- Enable RLS on all tables
alter table profiles enable row level security;
alter table beta_signups enable row level security;
alter table purchases enable row level security;
alter table license_keys enable row level security;
alter table license_activations enable row level security;
alter table plugin_releases enable row level security;
alter table downloads enable row level security;

-- ── Profiles ────────────────────────────────────────────────
create policy "Users can read own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

create policy "Admins can read all profiles"
  on profiles for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update all profiles"
  on profiles for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ── Beta signups ────────────────────────────────────────────
-- Anyone can insert (from marketing site using anon key)
create policy "Anyone can submit beta signup"
  on beta_signups for insert with check (true);

-- Only admins can view/manage
create policy "Admins can manage beta signups"
  on beta_signups for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ── License keys ────────────────────────────────────────────
create policy "Users can read own license keys"
  on license_keys for select using (user_id = auth.uid());

create policy "Admins can manage all license keys"
  on license_keys for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ── License activations ─────────────────────────────────────
create policy "Users can read own activations"
  on license_activations for select using (
    license_id in (select id from license_keys where user_id = auth.uid())
  );

create policy "Admins can manage all activations"
  on license_activations for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ── Purchases ───────────────────────────────────────────────
create policy "Users can read own purchases"
  on purchases for select using (user_id = auth.uid());

create policy "Admins can manage all purchases"
  on purchases for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ── Plugin releases ─────────────────────────────────────────
create policy "Authenticated users can view releases"
  on plugin_releases for select using (auth.role() = 'authenticated');

create policy "Admins can manage releases"
  on plugin_releases for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ── Downloads ───────────────────────────────────────────────
create policy "Users can insert own downloads"
  on downloads for insert with check (user_id = auth.uid());

create policy "Users can read own downloads"
  on downloads for select using (user_id = auth.uid());

create policy "Admins can manage all downloads"
  on downloads for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );


-- ============================================================
-- Storage Buckets (run separately in Storage settings)
-- ============================================================
-- 1. Create bucket: plugin-builds (private)
-- 2. Create bucket: preset-packs (private)
-- Note: Storage bucket creation is done via Supabase Dashboard
-- or via the Supabase Management API, not SQL.


-- ============================================================
-- Helper: Generate license key
-- ============================================================
create or replace function generate_license_key()
returns text as $$
declare
  key_part text;
  full_key text;
begin
  full_key := 'VSTGOD';
  for i in 1..4 loop
    key_part := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
    full_key := full_key || '-' || key_part;
  end loop;
  return full_key;
end;
$$ language plpgsql;

-- Example: SELECT generate_license_key();
-- Returns: VSTGOD-A1B2-C3D4-E5F6-G7H8

-- ============================================================
-- Ethereal Cloud Sync & Preset Sharing System
-- ============================================================

-- ── Preset Backups (User repositories) ─────────────────────
create table if not exists preset_backups (
  license_key text not null,
  machine_id text not null,
  presets_json text not null,
  updated_at timestamptz default now(),
  primary key (license_key, machine_id)
);

-- ── Shared Community Presets ───────────────────────────────
create table if not exists community_presets (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text not null,
  author text not null,
  rating int default 3,
  tags text[] default array[]::text[],
  energy_level int default 50,
  state jsonb not null,
  downloads int default 0,
  license_key text,
  machine_id text,
  created_at timestamptz default now()
);

-- ── Expansion Kits ─────────────────────────────────────────
create table if not exists expansion_kits (
  id text primary key,
  name text not null,
  description text,
  author text not null,
  tags text[] default array[]::text[],
  download_count int default 0,
  presets jsonb not null,
  created_at timestamptz default now()
);

-- Enable RLS
alter table preset_backups enable row level security;
alter table community_presets enable row level security;
alter table expansion_kits enable row level security;

-- Policies for preset_backups
create policy "Anyone can manage backups"
  on preset_backups for all using (true) with check (true);

-- Policies for community_presets
create policy "Anyone can view community presets"
  on community_presets for select using (true);

create policy "Anyone can insert community presets"
  on community_presets for insert with check (true);

create policy "Anyone can update community presets"
  on community_presets for update using (true);

-- Policies for expansion_kits
create policy "Anyone can view expansion kits"
  on expansion_kits for select using (true);

create policy "Anyone can update expansion kits"
  on expansion_kits for update using (true);
