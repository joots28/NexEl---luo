-- Permit upload cleanup only if metadata insertion failed. Published media cannot be deleted through this cleanup policy.
create policy learning_videos_storage_delete_untracked_uploads on storage.objects
for delete to authenticated using (
  bucket_id='learning-videos'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and not exists (select 1 from public.learning_videos v where v.storage_path=storage.objects.name)
  and exists (select 1 from public.teacher_verification_requests t where t.user_id=(select auth.uid()) and t.status='approved')
);
