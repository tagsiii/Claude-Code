-- User profile: stores your bio, goals, what you offer/need
create table user_profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  full_name text not null,
  bio text,
  job_title text,
  company text,
  industries text[] default '{}',
  goals text[] default '{}',
  what_i_offer text,
  what_i_need text,
  networking_style text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Contacts: people in your network
create table contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  full_name text not null,
  email text,
  phone text,
  company text,
  role text,
  linkedin_url text,
  twitter_handle text,
  location text,
  industries text[] default '{}',
  tags text[] default '{}',
  how_we_met text,
  relationship_tier text default 'acquaintance' check (relationship_tier in ('inner_circle', 'strong', 'moderate', 'acquaintance', 'dormant')),
  context_summary text, -- Claude-generated living summary
  last_interaction_at timestamptz,
  next_followup_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_contacts_user_id on contacts(user_id);
create index idx_contacts_relationship_tier on contacts(relationship_tier);
create index idx_contacts_last_interaction on contacts(last_interaction_at);

-- Interactions: log of every meeting, call, email exchange
create table interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  contact_id uuid not null references contacts(id) on delete cascade,
  interaction_type text not null check (interaction_type in ('meeting', 'call', 'email', 'coffee', 'event', 'message', 'other')),
  occurred_at timestamptz not null default now(),
  raw_notes text,
  ai_summary text, -- Claude-generated structured summary
  key_topics text[] default '{}',
  commitments_made text[] default '{}',
  follow_up_items text[] default '{}',
  sentiment text check (sentiment in ('very_positive', 'positive', 'neutral', 'negative', 'very_negative')),
  relationship_strength_delta integer default 0, -- -2 to +2
  calendar_event_id text, -- Google Calendar event ID
  created_at timestamptz default now()
);

create index idx_interactions_contact on interactions(contact_id);
create index idx_interactions_user on interactions(user_id);
create index idx_interactions_occurred on interactions(occurred_at desc);

-- Relationship graph: edges between contacts
create table relationship_graph (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  contact_a_id uuid not null references contacts(id) on delete cascade,
  contact_b_id uuid not null references contacts(id) on delete cascade,
  relationship_type text not null, -- e.g., 'colleagues', 'friends', 'introduced_by_me'
  strength integer default 5 check (strength between 1 and 10),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, contact_a_id, contact_b_id)
);

create index idx_rel_graph_user on relationship_graph(user_id);

-- AI recommendations: Claude-generated action items
create table ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  contact_id uuid references contacts(id) on delete cascade,
  type text not null check (type in ('follow_up', 'introduction_request', 'prep_brief', 'content_to_share', 'network_gap', 'relationship_alert')),
  priority integer default 5 check (priority between 1 and 10),
  title text not null,
  description text not null,
  suggested_message text,
  reasoning text,
  status text default 'pending' check (status in ('pending', 'accepted', 'dismissed', 'completed')),
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_recommendations_user on ai_recommendations(user_id);
create index idx_recommendations_status on ai_recommendations(status);

-- Call prep documents
create table call_preps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  contact_id uuid not null references contacts(id) on delete cascade,
  calendar_event_id text,
  meeting_purpose text,
  contact_summary text, -- Step 1 output
  agenda text, -- Step 2 output
  potential_outcomes text, -- Step 3 output
  full_document text, -- Step 4 compiled output
  status text default 'draft' check (status in ('draft', 'generating', 'ready', 'used')),
  meeting_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_call_preps_user on call_preps(user_id);
create index idx_call_preps_meeting on call_preps(meeting_at);

-- Enable Row Level Security
alter table user_profile enable row level security;
alter table contacts enable row level security;
alter table interactions enable row level security;
alter table relationship_graph enable row level security;
alter table ai_recommendations enable row level security;
alter table call_preps enable row level security;

-- RLS policies (user can only access their own data)
create policy "Users can manage their own profile" on user_profile
  for all using (auth.uid() = user_id);

create policy "Users can manage their own contacts" on contacts
  for all using (auth.uid() = user_id);

create policy "Users can manage their own interactions" on interactions
  for all using (auth.uid() = user_id);

create policy "Users can manage their own relationship graph" on relationship_graph
  for all using (auth.uid() = user_id);

create policy "Users can manage their own recommendations" on ai_recommendations
  for all using (auth.uid() = user_id);

create policy "Users can manage their own call preps" on call_preps
  for all using (auth.uid() = user_id);

-- Updated_at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_user_profile_updated_at before update on user_profile
  for each row execute function update_updated_at();
create trigger update_contacts_updated_at before update on contacts
  for each row execute function update_updated_at();
create trigger update_relationship_graph_updated_at before update on relationship_graph
  for each row execute function update_updated_at();
create trigger update_recommendations_updated_at before update on ai_recommendations
  for each row execute function update_updated_at();
create trigger update_call_preps_updated_at before update on call_preps
  for each row execute function update_updated_at();
