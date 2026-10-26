-- Wardrobe: initial schema.
-- Every table carries user_id (default auth.uid()) and RLS restricting rows to their owner.
-- Single-user today; the allowlist is enforced in the app (ALLOWED_EMAIL). Scoping by user_id
-- keeps a future multi-user mode possible without a data migration.
-- Phase 5/6 columns (fit_areas, is_reference, brand_sizes, wear_log.photo_url) exist already.


-- ───────────────────────── items
create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status text not null default 'owned'
    check (status in ('owned', 'wishlist', 'considered', 'passed', 'archived')),
  photo_url text,
  cutout_url text,
  label_photo_urls text[] not null default '{}',
  category text not null default 'other'
    check (category in ('top', 'bottom', 'one-piece', 'outerwear', 'shoes', 'accessory', 'bag', 'other')),
  subcategory text,
  colors jsonb not null default '[]'::jsonb, -- [{name, hex, role: primary|secondary}]
  pattern text,
  material text,
  formality smallint check (formality between 1 and 5),
  warmth smallint check (warmth between 1 and 5),
  seasons text[] not null default '{}',
  brand text,
  size_label text,
  fit_verdict text
    check (fit_verdict in ('too small', 'slightly small', 'perfect', 'slightly big', 'too big')),
  fit_notes text,
  fit_areas jsonb, -- Phase 5: {shoulders: verdict, length: verdict, ...}
  is_reference boolean not null default false, -- Phase 5: reference garment for fit predictions
  price numeric(10, 2),
  currency text,
  acquired_date date,
  source text check (source in ('store', 'vintage', 'online', 'gift', 'other')),
  notes text,
  ai_raw jsonb,
  user_verified boolean not null default false,
  capture_seconds real,
  created_at timestamptz not null default now()
);
create index items_user_status_idx on public.items (user_id, status);

-- ───────────────────────── body_profile (one row per user)
create table public.body_profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users (id) on delete cascade,
  height_cm real,
  weight_kg real,
  measurements jsonb not null default '{}'::jsonb, -- chest, waist, hips, inseam, shoulder… all optional
  shape_notes text,
  fit_preferences text,
  style_goals text,
  updated_at timestamptz,
  created_at timestamptz not null default now()
);

-- ───────────────────────── brand_sizes (learned fit per brand; filled in Phase 5)
create table public.brand_sizes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  brand text not null,
  size_label text not null,
  garment_type text,
  fit_verdict text
    check (fit_verdict in ('too small', 'slightly small', 'perfect', 'slightly big', 'too big')),
  notes text,
  item_id uuid references public.items (id) on delete set null,
  created_at timestamptz not null default now()
);
create index brand_sizes_user_brand_idx on public.brand_sizes (user_id, lower(brand));

-- ───────────────────────── outfits
create table public.outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_ids text[] not null default '{}',
  context jsonb not null default '{}'::jsonb, -- {mood, occasion, weather}
  origin text not null default 'manual' check (origin in ('suggested', 'manual', 'logged')),
  rationale text,
  created_at timestamptz not null default now()
);
create index outfits_user_created_idx on public.outfits (user_id, created_at desc);

-- ───────────────────────── wear_log (wear count / last worn are derived from here)
create table public.wear_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null default current_date,
  outfit_id uuid references public.outfits (id) on delete set null,
  item_ids text[] not null default '{}', -- copied from the outfit so history survives outfit deletion
  photo_url text, -- Phase 6: mirror selfie
  notes text,
  created_at timestamptz not null default now()
);
create index wear_log_user_date_idx on public.wear_log (user_id, date desc);

-- ───────────────────────── feedback
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  outfit_id uuid references public.outfits (id) on delete set null,
  item_ids text[] not null default '{}',
  rating smallint not null default 0 check (rating in (-1, 0, 1)),
  reason_tags text[] not null default '{}',
  comment text,
  created_at timestamptz not null default now()
);
create index feedback_user_created_idx on public.feedback (user_id, created_at desc);

-- ───────────────────────── style_profile (versioned: newest row is current)
create table public.style_profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  summary text not null default '',
  summary_source text not null default 'ai' check (summary_source in ('ai', 'user')),
  hard_rules jsonb not null default '[]'::jsonb, -- [{text, source: ai|user}]
  soft_preferences jsonb not null default '[]'::jsonb, -- [{text, source: ai|user}]
  diff text,
  generated_from_feedback_until timestamptz,
  edited_by_user boolean not null default false,
  created_at timestamptz not null default now()
);
create index style_profile_user_created_idx on public.style_profile (user_id, created_at desc);

-- ───────────────────────── moods
create table public.moods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  description text not null default '',
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index moods_user_name_idx on public.moods (user_id, lower(name));

-- ───────────────────────── scans (shop mode)
create table public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  photo_urls text[] not null default '{}',
  photo_kinds text[] not null default '{}', -- garment | brand | care | price | screenshot
  cutout_url text,
  extracted jsonb,
  verdict jsonb,
  status text not null default 'pending' check (status in ('pending', 'done', 'error')),
  error text,
  source text check (source in ('store', 'vintage', 'online', 'gift', 'other')),
  location_text text,
  price numeric(10, 2),
  currency text,
  decision text not null default 'undecided' check (decision in ('bought', 'skipped', 'undecided')),
  saved_as text check (saved_as in ('considered', 'wishlist')),
  item_id uuid references public.items (id) on delete set null,
  latency_ms integer,
  created_at timestamptz not null default now()
);
create index scans_user_created_idx on public.scans (user_id, created_at desc);

-- ───────────────────────── ai_calls (cost log)
create table public.ai_calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  est_cost_usd numeric(10, 6) not null default 0,
  latency_ms integer,
  ok boolean not null default true,
  created_at timestamptz not null default now()
);
create index ai_calls_user_created_idx on public.ai_calls (user_id, created_at desc);

-- ───────────────────────── row level security
do $$
declare t text;
begin
  foreach t in array array[
    'items', 'body_profile', 'brand_sizes', 'outfits', 'wear_log', 'feedback',
    'style_profile', 'moods', 'scans', 'ai_calls'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_owner', t);
  end loop;
end $$;

-- ───────────────────────── storage: private bucket, objects under <user_id>/...
insert into storage.buckets (id, name, public)
values ('wardrobe', 'wardrobe', false)
on conflict (id) do nothing;

create policy "wardrobe_owner_select" on storage.objects for select to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "wardrobe_owner_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "wardrobe_owner_update" on storage.objects for update to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "wardrobe_owner_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
