import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("package defines reproducible build and test commands", () => {
  const p = JSON.parse(read("../package.json"));
  assert.ok(p.scripts.build && p.scripts.test);
});

test("client bundle never declares service-role credentials", () => {
  const files = ["../src/App.jsx", "../src/main.jsx", "../src/styles.css", "../src/backend.css", "../index.html"];
  for (const f of files) assert.doesNotMatch(read(f), /SUPABASE_SERVICE_ROLE|service_role_key/i);
});

test("responsive shell and mobile navigation are present", () => {
  const app = read("../src/App.jsx");
  const css = read("../src/styles.css");
  assert.match(app, /mobile-nav/);
  assert.match(css, /@media\(max-width:760px\)/);
});

test("post composer validates text and sends it to Supabase", () => {
  const app = read("../src/App.jsx");
  assert.match(app, /const body = draft\.trim\(\)/);
  assert.match(app, /body\.length > 500/);
  assert.match(app, /from\("social_posts"\)\.insert/);
});

test("email signup and password login use Supabase Auth", () => {
  const app = read("../src/App.jsx");
  assert.match(app, /auth\.signUp/);
  assert.match(app, /auth\.signInWithPassword/);
  assert.match(app, /auth\.signOut/);
});

test("social interactions persist to database tables", () => {
  const app = read("../src/App.jsx");
  for (const table of ["social_post_likes", "social_post_reposts", "social_post_bookmarks", "social_follows", "social_post_replies"]) {
    assert.ok(app.includes(table), "missing Supabase operation for " + table);
  }
  assert.match(app, /from\("profiles"\)/);
  assert.match(app, /from\("social_post_replies"\)\.insert/);
  assert.match(app, /aria-labelledby="replies-title"/);
  assert.match(app, /create_server_with_defaults/);
  assert.match(app, /from\("messages"\)\.insert/);
  assert.match(app, /from\("server_members"\)\.insert/);
  assert.match(app, /body\.length > 300/);
});

test("README documents communities and text chat without claiming voice is ready", () => {
  const readme = read("../README.md");
  assert.match(readme, /cadastro e login/i);
  assert.match(readme, /curtidas/i);
  assert.match(readme, /mensagens (diretas )?privadas/i);
  assert.match(readme, /chat de texto persistente/i);
  assert.match(readme, /voz\/vídeo/i);
});

test("private messages have participant-only RLS and a connected UI", () => {
  const app = read("../src/App.jsx");
  const migration = read("../supabase/migrations/20261019024300_create_private_direct_messages.sql");
  assert.match(app, /from\("direct_messages"\)\.insert/);
  assert.match(app, /from\("direct_messages"\)/);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /direct_messages_select_participant/i);
  assert.match(migration, /sender_id = \(select auth\.uid\(\)\)/i);
  assert.match(migration, /recipient_id = \(select auth\.uid\(\)\)/i);
});

test("environment template is tracked and local secrets are ignored", () => {
  assert.ok(existsSync(new URL("../.env.example", import.meta.url)));
  assert.match(read("../.gitignore"), /\.env\.\*/);
});


test("guest content gate and OAuth sign-in providers are implemented", () => {
  const app = read("../src/App.jsx");
  const migration = read("../supabase/migrations/20261019025448_require_authenticated_to_read_social_content.sql");
  assert.match(app, /authInitialized/);
  assert.match(app, /if \(!user\) \{/);
  assert.match(app, /signInWithOAuth/);
  assert.match(app, /signInWithProvider\("github"\)/);
  assert.match(app, /signInWithProvider\("google"\)/);
  assert.match(app, /Continuar com GitHub/);
  assert.match(app, /Continuar com Google/);
  assert.match(app, /OU USE SEU E-MAIL/);
  assert.match(migration, /create policy social_posts_read_authenticated/i);
  assert.match(migration, /for select\s+to authenticated/i);
  assert.doesNotMatch(migration, /to anon/i);
});


test("learning hub requires signed-in access and recommends lessons from learner profile", () => {
  const app = read("../src/App.jsx");
  const hub = read("../src/components/LearningHub.jsx");
  const css = read("../src/education.css");
  assert.match(app, /<LearningHub user={user} \/>/);
  assert.match(app, /\["Aprender",/);
  assert.match(hub, /from\("learning_profiles"\)/);
  assert.match(hub, /scoreVideo/);
  assert.match(hub, /questionnaire_completed/);
  assert.match(hub, /from\("learning_challenge_attempts"\)\.insert/);
  assert.match(css, /\.learning-page/);
});

test("teacher-only video upload is enforced by database and private storage", () => {
  const migration = read("../supabase/migrations/20261019030000_nexel_learning_hub_teacher_verification_and_help_forum.sql");
  const cleanupMigration = read("../supabase/migrations/20261019030505_nexel_allow_cleanup_untracked_learning_video_uploads.sql");
  const hub = read("../src/components/LearningHub.jsx");
  assert.match(migration, /create table if not exists public\.teacher_verification_requests/i);
  assert.match(migration, /create table if not exists public\.platform_admins/i);
  assert.match(migration, /learning_videos_insert_verified_teacher/i);
  assert.match(migration, /status = 'pending_review'/i);
  assert.match(migration, /values \('learning-videos', 'learning-videos', false, 52428800/i);
  assert.match(migration, /video\/mp4/);
  assert.match(hub, /Somente professores verificados podem enviar vídeos/);
  assert.match(hub, /50 \* 1024 \* 1024/);
  assert.match(hub, /reviewVideo/);
  assert.match(cleanupMigration, /not exists \(select 1 from public\.learning_videos/i);
});

test("developer help forum stores questions, answers, votes and accepted solutions", () => {
  const forum = read("../src/components/HelpForum.jsx");
  const migration = read("../supabase/migrations/20261019030000_nexel_learning_hub_teacher_verification_and_help_forum.sql");
  const safetyMigration = read("../supabase/migrations/20261019030049_nexel_protect_help_answer_acceptance_and_authorship.sql");
  assert.match(forum, /from\("help_questions"\)\.insert/);
  assert.match(forum, /from\("help_answers"\)\.insert/);
  assert.match(forum, /from\("help_question_votes"\)/);
  assert.match(forum, /Marcar como solução/);
  assert.match(migration, /enable row level security/i);
  assert.match(safetyMigration, /guard_help_answer_update/i);
  assert.match(safetyMigration, /A resposta não pode ser transferida/i);
});

test("README describes the education area and platform admin bootstrap", () => {
  const readme = read("../README.md");
  assert.match(readme, /Dev Academy/i);
  assert.match(readme, /professores.*verificados/i);
  assert.match(readme, /Mural de ajuda/i);
  assert.match(readme, /platform_admins/i);
  assert.match(readme, /50 MB/i);
});


test("learning video status mapping has no duplicate rejected key", () => {
  const hub = read("../src/components/LearningHub.jsx");
  const statusMap = hub.match(/function statusCopy\(status\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.equal((statusMap.match(/rejected\s*:/g) || []).length, 1);
});


test("curated YouTube lessons are embedded and personalized in Dev Academy", () => {
  const hub = read("../src/components/LearningHub.jsx");
  const css = read("../src/education.css");
  assert.match(hub, /CURATED_YOUTUBE_VIDEOS/);
  assert.match(hub, /Aulas do Prof\. Caio Malheiros/);
  assert.match(hub, /youtube-nocookie\.com\/embed/);
  assert.match(hub, /sort\(\(a, b\) => scoreVideo\(b, learner\) - scoreVideo\(a, learner\)\)/);
  assert.match(hub, /youtube\.com\/@caiomalheiros/);
  assert.match(css, /\.learn-video-player iframe/);
});
