-- Learning and educational video publishing.
-- Teacher status and platform-administrator membership are never self-assigned.
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;
grant select on public.platform_admins to authenticated;
drop policy if exists platform_admins_read_self on public.platform_admins;
create policy platform_admins_read_self on public.platform_admins
for select to authenticated using (user_id = (select auth.uid()));

create table if not exists public.teacher_verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  institution text not null check (char_length(trim(institution)) between 2 and 120),
  professional_email text,
  professional_profile_url text,
  expertise text not null check (char_length(trim(expertise)) between 2 and 180),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewer_id uuid references auth.users(id) on delete set null,
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (professional_email is null or char_length(professional_email) <= 254),
  check (professional_profile_url is null or char_length(professional_profile_url) <= 500),
  check (review_note is null or char_length(review_note) <= 500)
);
create index if not exists teacher_verification_requests_user_status_idx on public.teacher_verification_requests(user_id, status, created_at desc);
create unique index if not exists teacher_one_pending_request_per_user on public.teacher_verification_requests(user_id) where status = 'pending';
alter table public.teacher_verification_requests enable row level security;
revoke all on public.teacher_verification_requests from anon, authenticated;
grant select, insert, update on public.teacher_verification_requests to authenticated;
create policy teacher_requests_read_owner_or_admin on public.teacher_verification_requests
for select to authenticated using (
  user_id = (select auth.uid()) or exists (select 1 from public.platform_admins pa where pa.user_id = (select auth.uid()))
);
create policy teacher_requests_create_pending_self on public.teacher_verification_requests
for insert to authenticated with check (
  user_id = (select auth.uid()) and status = 'pending' and reviewer_id is null and reviewed_at is null and review_note is null
);
create policy teacher_requests_admin_review on public.teacher_verification_requests
for update to authenticated
using (exists (select 1 from public.platform_admins pa where pa.user_id = (select auth.uid())))
with check (exists (select 1 from public.platform_admins pa where pa.user_id = (select auth.uid())));

create table if not exists public.learning_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  interest_tags text[] not null default '{}',
  current_level text not null default 'iniciante' check (current_level in ('iniciante','intermediario','avancado')),
  preferred_languages text[] not null default '{}',
  learning_goal text not null default 'fundamentos' check (learning_goal in ('fundamentos','web','backend','mobile','dados','carreira')),
  questionnaire_completed boolean not null default false,
  updated_at timestamptz not null default now(),
  check (cardinality(interest_tags) <= 12),
  check (cardinality(preferred_languages) <= 8)
);
alter table public.learning_profiles enable row level security;
revoke all on public.learning_profiles from anon, authenticated;
grant select, insert, update on public.learning_profiles to authenticated;
create policy learning_profiles_read_self on public.learning_profiles for select to authenticated using (user_id = (select auth.uid()));
create policy learning_profiles_insert_self on public.learning_profiles for insert to authenticated with check (user_id = (select auth.uid()));
create policy learning_profiles_update_self on public.learning_profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.learning_videos (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 4 and 120),
  description text not null default '' check (char_length(description) <= 700),
  topic text not null check (char_length(trim(topic)) between 2 and 50),
  level text not null default 'iniciante' check (level in ('iniciante','intermediario','avancado')),
  programming_language text not null default 'javascript' check (programming_language in ('javascript','python','csharp','kotlin','sql','html-css','geral')),
  tags text[] not null default '{}',
  storage_path text not null unique,
  status text not null default 'pending_review' check (status in ('pending_review','published','rejected')),
  moderation_note text,
  reviewer_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(tags) <= 12),
  check (char_length(storage_path) <= 500),
  check (moderation_note is null or char_length(moderation_note) <= 500)
);
create index if not exists learning_videos_status_created_idx on public.learning_videos(status, created_at desc);
create index if not exists learning_videos_teacher_created_idx on public.learning_videos(teacher_id, created_at desc);
alter table public.learning_videos enable row level security;
revoke all on public.learning_videos from anon, authenticated;
grant select, insert, update on public.learning_videos to authenticated;
create policy learning_videos_read_published_owner_admin on public.learning_videos for select to authenticated
using (
  status = 'published' or teacher_id = (select auth.uid()) or exists (select 1 from public.platform_admins pa where pa.user_id = (select auth.uid()))
);
create policy learning_videos_insert_verified_teacher on public.learning_videos for insert to authenticated with check (
  teacher_id = (select auth.uid()) and status = 'pending_review' and reviewer_id is null and reviewed_at is null
  and exists (select 1 from public.teacher_verification_requests t where t.user_id = (select auth.uid()) and t.status = 'approved')
);
create policy learning_videos_teacher_update_pending on public.learning_videos for update to authenticated
using (
  teacher_id = (select auth.uid()) and status = 'pending_review'
  and exists (select 1 from public.teacher_verification_requests t where t.user_id = (select auth.uid()) and t.status = 'approved')
)
with check (
  teacher_id = (select auth.uid()) and status = 'pending_review' and reviewer_id is null and reviewed_at is null
  and exists (select 1 from public.teacher_verification_requests t where t.user_id = (select auth.uid()) and t.status = 'approved')
);
create policy learning_videos_admin_review on public.learning_videos for update to authenticated
using (exists (select 1 from public.platform_admins pa where pa.user_id = (select auth.uid())))
with check (exists (select 1 from public.platform_admins pa where pa.user_id = (select auth.uid())));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('learning-videos', 'learning-videos', false, 52428800, array['video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public=false, file_size_limit=52428800, allowed_mime_types=array['video/mp4','video/webm','video/quicktime'];
create policy learning_videos_storage_insert_verified_teacher on storage.objects for insert to authenticated with check (
  bucket_id='learning-videos' and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists (select 1 from public.teacher_verification_requests t where t.user_id=(select auth.uid()) and t.status='approved')
);
create policy learning_videos_storage_read_authorized on storage.objects for select to authenticated using (
  bucket_id='learning-videos' and exists (
    select 1 from public.learning_videos v where v.storage_path=storage.objects.name
    and (v.status='published' or v.teacher_id=(select auth.uid()) or exists (select 1 from public.platform_admins pa where pa.user_id=(select auth.uid())))
  )
);
create policy learning_videos_storage_update_owner on storage.objects for update to authenticated
using (
  bucket_id='learning-videos' and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists (select 1 from public.teacher_verification_requests t where t.user_id=(select auth.uid()) and t.status='approved')
)
with check (
  bucket_id='learning-videos' and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists (select 1 from public.teacher_verification_requests t where t.user_id=(select auth.uid()) and t.status='approved')
);

create table if not exists public.help_questions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 8 and 160),
  body text not null check (char_length(trim(body)) between 10 and 5000),
  topic text not null default 'Geral' check (char_length(trim(topic)) between 2 and 40),
  programming_language text not null default 'geral' check (programming_language in ('javascript','python','csharp','kotlin','sql','html-css','geral')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists help_questions_created_idx on public.help_questions(created_at desc);
create index if not exists help_questions_topic_idx on public.help_questions(topic, created_at desc);
alter table public.help_questions enable row level security;
revoke all on public.help_questions from anon, authenticated;
grant select, insert, update, delete on public.help_questions to authenticated;
create policy help_questions_read_authenticated on public.help_questions for select to authenticated using (true);
create policy help_questions_insert_self on public.help_questions for insert to authenticated with check (author_id = (select auth.uid()));
create policy help_questions_update_self on public.help_questions for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy help_questions_delete_self on public.help_questions for delete to authenticated using (author_id = (select auth.uid()));

create table if not exists public.help_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.help_questions(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 2 and 3000),
  is_accepted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists help_answers_question_created_idx on public.help_answers(question_id, created_at);
create unique index if not exists help_answers_one_accepted_per_question_idx on public.help_answers(question_id) where is_accepted;
alter table public.help_answers enable row level security;
revoke all on public.help_answers from anon, authenticated;
grant select, insert, update, delete on public.help_answers to authenticated;
create policy help_answers_read_authenticated on public.help_answers for select to authenticated using (true);
create policy help_answers_insert_self on public.help_answers for insert to authenticated with check (
  author_id=(select auth.uid()) and exists (select 1 from public.help_questions q where q.id=question_id) and is_accepted=false
);
create policy help_answers_update_author_or_question_owner on public.help_answers for update to authenticated
using (
  author_id=(select auth.uid()) or exists (select 1 from public.help_questions q where q.id=question_id and q.author_id=(select auth.uid()))
)
with check (
  author_id=(select auth.uid()) or exists (select 1 from public.help_questions q where q.id=question_id and q.author_id=(select auth.uid()))
);
create policy help_answers_delete_author on public.help_answers for delete to authenticated using (author_id=(select auth.uid()));

create table if not exists public.help_question_votes (
  question_id uuid not null references public.help_questions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote smallint not null check (vote in (-1,1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (question_id,user_id)
);
alter table public.help_question_votes enable row level security;
revoke all on public.help_question_votes from anon, authenticated;
grant select, insert, update, delete on public.help_question_votes to authenticated;
create policy help_question_votes_read_authenticated on public.help_question_votes for select to authenticated using (true);
create policy help_question_votes_insert_self on public.help_question_votes for insert to authenticated with check (user_id=(select auth.uid()));
create policy help_question_votes_update_self on public.help_question_votes for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy help_question_votes_delete_self on public.help_question_votes for delete to authenticated using (user_id=(select auth.uid()));

create table if not exists public.learning_challenge_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_slug text not null check (char_length(challenge_slug) between 2 and 80),
  selected_answer text not null check (char_length(selected_answer) <= 500),
  is_correct boolean not null,
  attempted_at timestamptz not null default now()
);
create index if not exists learning_challenge_attempts_user_time_idx on public.learning_challenge_attempts(user_id, attempted_at desc);
alter table public.learning_challenge_attempts enable row level security;
revoke all on public.learning_challenge_attempts from anon, authenticated;
grant select, insert on public.learning_challenge_attempts to authenticated;
create policy learning_attempts_read_self on public.learning_challenge_attempts for select to authenticated using (user_id=(select auth.uid()));
create policy learning_attempts_insert_self on public.learning_challenge_attempts for insert to authenticated with check (user_id=(select auth.uid()));
