-- Direct messages between two profiles. Every row is readable only by its sender and recipient.
create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  constraint direct_messages_no_self check (sender_id <> recipient_id)
);

create index if not exists direct_messages_sender_created_idx
  on public.direct_messages (sender_id, created_at desc);

create index if not exists direct_messages_recipient_created_idx
  on public.direct_messages (recipient_id, created_at desc);

alter table public.direct_messages enable row level security;

revoke all on table public.direct_messages from anon, authenticated;
grant select, insert on table public.direct_messages to authenticated;

drop policy if exists direct_messages_select_participant on public.direct_messages;
create policy direct_messages_select_participant
  on public.direct_messages
  for select
  to authenticated
  using ((sender_id = (select auth.uid())) or (recipient_id = (select auth.uid())));

drop policy if exists direct_messages_insert_sender on public.direct_messages;
create policy direct_messages_insert_sender
  on public.direct_messages
  for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and sender_id <> recipient_id
  );
