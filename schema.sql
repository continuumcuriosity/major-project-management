-- Research Field Log — Supabase schema
-- Run this once in your Supabase project's SQL Editor (left sidebar -> SQL Editor -> New query)

create table entries (
  id uuid primary key default gen_random_uuid(),
  type text not null,              -- 'session' | 'paper' | 'decision'
  date date not null,
  duration integer,                -- minutes, sessions only
  verdict text,                    -- papers only: accepted / rejected / maybe / related-work / etc
  title text,                      -- paper title, or short decision label
  link text,                       -- paper link/DOI
  tags text[],                     -- paper tags
  summary text,                    -- session: what was covered
  next_step text,                  -- session: open question / follow-up
  reason text,                     -- paper: verdict reasoning
  decision text,                   -- decision: what was decided
  rationale text,                  -- decision: why
  alternatives text,               -- decision: what else was considered
  next_done boolean default false, -- session: whether the "next step" has been resolved (drives the to-do widget)
  calendar_added boolean default false, -- session: whether a calendar event has been created for it
  calendar_event_link text,        -- session: real link to the created Google Calendar event, once verified
  created_at timestamptz default now()
);

-- Row Level Security: on, with an open policy for now.
-- This is a small trusted-team tool, not a public product, so we allow
-- anyone holding the anon key (i.e. anyone with your deployed URL) to
-- read/write. Tighten this later if you add login (see README "Later" section).
alter table entries enable row level security;

create policy "allow all reads" on entries
  for select using (true);

create policy "allow all inserts" on entries
  for insert with check (true);

create policy "allow all deletes" on entries
  for delete using (true);
