-- Prevent answer authorship changes and limit question owners to marking accepted answers.
create or replace function private.guard_help_answer_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.question_id is distinct from old.question_id
     or new.author_id is distinct from old.author_id
     or new.created_at is distinct from old.created_at then
    raise exception 'A resposta não pode ser transferida para outra pergunta ou autoria.';
  end if;

  if old.author_id = (select auth.uid()) then
    if new.is_accepted is distinct from old.is_accepted then
      raise exception 'Somente quem fez a pergunta pode marcar a resposta como aceita.';
    end if;
  elsif exists (
    select 1 from public.help_questions q
    where q.id = old.question_id and q.author_id = (select auth.uid())
  ) then
    if new.body is distinct from old.body then
      raise exception 'Quem fez a pergunta só pode aceitar ou desmarcar uma resposta.';
    end if;
  else
    raise exception 'Você não tem permissão para alterar esta resposta.';
  end if;
  return new;
end;
$$;

drop trigger if exists help_answers_guard_update on public.help_answers;
create trigger help_answers_guard_update before update on public.help_answers
for each row execute function private.guard_help_answer_update();

drop policy if exists help_answers_update_question_owner_acceptance on public.help_answers;
drop policy if exists help_answers_update_author_or_question_owner on public.help_answers;
create policy help_answers_update_author_or_question_owner on public.help_answers
for update to authenticated
using (
  author_id=(select auth.uid())
  or exists (select 1 from public.help_questions q where q.id=question_id and q.author_id=(select auth.uid()))
)
with check (
  author_id=(select auth.uid())
  or exists (select 1 from public.help_questions q where q.id=question_id and q.author_id=(select auth.uid()))
);

drop policy if exists help_question_votes_insert_self on public.help_question_votes;
drop policy if exists help_question_votes_update_self on public.help_question_votes;
create policy help_question_votes_insert_self on public.help_question_votes
for insert to authenticated with check (
  user_id=(select auth.uid())
  and exists (select 1 from public.help_questions q where q.id=question_id and q.author_id<>(select auth.uid()))
);
create policy help_question_votes_update_self on public.help_question_votes
for update to authenticated
using (user_id=(select auth.uid()) and exists (select 1 from public.help_questions q where q.id=question_id and q.author_id<>(select auth.uid())))
with check (user_id=(select auth.uid()) and exists (select 1 from public.help_questions q where q.id=question_id and q.author_id<>(select auth.uid())));

create policy learning_videos_storage_delete_untracked_uploads on storage.objects
for delete to authenticated
using (
  bucket_id='learning-videos'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and not exists (select 1 from public.learning_videos v where v.storage_path=storage.objects.name)
  and exists (select 1 from public.teacher_verification_requests t where t.user_id=(select auth.uid()) and t.status='approved')
);
