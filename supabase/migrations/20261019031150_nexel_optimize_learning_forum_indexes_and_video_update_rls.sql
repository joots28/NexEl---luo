-- Add indexes to new foreign keys and combine video-update policies.
create index if not exists help_answers_author_id_idx
  on public.help_answers(author_id);
create index if not exists help_question_votes_user_id_idx
  on public.help_question_votes(user_id);
create index if not exists help_questions_author_id_idx
  on public.help_questions(author_id);
create index if not exists learning_videos_reviewer_id_idx
  on public.learning_videos(reviewer_id);
create index if not exists teacher_verification_requests_reviewer_id_idx
  on public.teacher_verification_requests(reviewer_id);

drop policy if exists learning_videos_teacher_update_pending on public.learning_videos;
drop policy if exists learning_videos_admin_review on public.learning_videos;
create policy learning_videos_update_admin_or_verified_teacher
on public.learning_videos
for update to authenticated
using (
  exists (
    select 1 from public.platform_admins pa
    where pa.user_id = (select auth.uid())
  )
  or (
    teacher_id = (select auth.uid())
    and status = 'pending_review'
    and exists (
      select 1 from public.teacher_verification_requests t
      where t.user_id = (select auth.uid())
        and t.status = 'approved'
    )
  )
)
with check (
  exists (
    select 1 from public.platform_admins pa
    where pa.user_id = (select auth.uid())
  )
  or (
    teacher_id = (select auth.uid())
    and status = 'pending_review'
    and reviewer_id is null
    and reviewed_at is null
    and moderation_note is null
    and storage_path like ((select auth.uid())::text || '/%')
    and exists (
      select 1 from public.teacher_verification_requests t
      where t.user_id = (select auth.uid())
        and t.status = 'approved'
    )
  )
);
