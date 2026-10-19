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
