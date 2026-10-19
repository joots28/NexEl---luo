-- Prevent logged-out visitors from reading social content through the public Data API.
-- Signed-in users keep access to public posts and profile details under RLS.

drop policy if exists profiles_read_public on public.profiles;
create policy profiles_read_authenticated
on public.profiles
for select
to authenticated
using (true);

drop policy if exists social_posts_read_public on public.social_posts;
create policy social_posts_read_authenticated
on public.social_posts
for select
to authenticated
using (visibility = 'public');

drop policy if exists social_post_likes_read_public on public.social_post_likes;
create policy social_post_likes_read_authenticated
on public.social_post_likes
for select
to authenticated
using (
  exists (
    select 1 from public.social_posts p
    where p.id = social_post_likes.post_id
      and p.visibility = 'public'
  )
);

drop policy if exists social_post_reposts_read_public on public.social_post_reposts;
create policy social_post_reposts_read_authenticated
on public.social_post_reposts
for select
to authenticated
using (
  exists (
    select 1 from public.social_posts p
    where p.id = social_post_reposts.post_id
      and p.visibility = 'public'
  )
);

drop policy if exists social_post_replies_read_public on public.social_post_replies;
create policy social_post_replies_read_authenticated
on public.social_post_replies
for select
to authenticated
using (
  exists (
    select 1 from public.social_posts p
    where p.id = social_post_replies.post_id
      and p.visibility = 'public'
  )
);
