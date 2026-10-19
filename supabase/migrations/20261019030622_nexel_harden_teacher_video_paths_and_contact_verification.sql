-- Require a professional contact for teacher verification and ensure teacher-owned video paths.
alter table public.teacher_verification_requests
  add constraint teacher_verification_requires_professional_contact
  check (
    nullif(trim(professional_email), '') is not null
    or nullif(trim(professional_profile_url), '') is not null
  );

alter table public.learning_videos
  drop constraint if exists learning_videos_storage_path_not_empty;
alter table public.learning_videos
  add constraint learning_videos_storage_path_not_empty
  check (char_length(trim(storage_path)) > 0);

drop policy if exists learning_videos_insert_verified_teacher on public.learning_videos;
create policy learning_videos_insert_verified_teacher
on public.learning_videos for insert to authenticated with check (
  teacher_id=(select auth.uid())
  and status='pending_review'
  and reviewer_id is null
  and reviewed_at is null
  and (storage_path like ((select auth.uid())::text || '/%'))
  and exists (select 1 from public.teacher_verification_requests t where t.user_id=(select auth.uid()) and t.status='approved')
);

drop policy if exists learning_videos_teacher_update_pending on public.learning_videos;
create policy learning_videos_teacher_update_pending
on public.learning_videos for update to authenticated
using (
  teacher_id=(select auth.uid())
  and status='pending_review'
  and exists (select 1 from public.teacher_verification_requests t where t.user_id=(select auth.uid()) and t.status='approved')
)
with check (
  teacher_id=(select auth.uid())
  and status='pending_review'
  and reviewer_id is null
  and reviewed_at is null
  and moderation_note is null
  and (storage_path like ((select auth.uid())::text || '/%'))
  and exists (select 1 from public.teacher_verification_requests t where t.user_id=(select auth.uid()) and t.status='approved')
);
