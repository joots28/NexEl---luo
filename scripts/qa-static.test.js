import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
test("package defines reproducible build and test commands", () => {
  const p = JSON.parse(read("../package.json"));
  assert.ok(p.scripts.build && p.scripts.test);
});
test("client bundle never declares service-role credentials", () => {
  const files = ["../src/App.jsx", "../src/main.jsx", "../src/styles.css", "../index.html"];
  for (const f of files) assert.doesNotMatch(read(f), /SUPABASE_SERVICE_ROLE|service_role_key/i);
});
test("responsive shell and mobile navigation are present", () => {
  const app = read("../src/App.jsx");
  const css = read("../src/styles.css");
  assert.match(app, /mobile-nav/);
  assert.match(css, /@media\(max-width:760px\)/);
});
test("post composer validates blank and over-limit text", () => {
  const app = read("../src/App.jsx");
  assert.match(app, /const body = draft\.trim\(\)/);
  assert.match(app, /body\.length > 500/);
});
test("local preview clearly discloses backend is not connected", () => {
  assert.match(read("../README.md"), /ainda não está conectada à autenticação nem às consultas remotas/i);
});
test("env template is tracked and local secrets are ignored", () => {
  assert.ok(existsSync(new URL("../.env.example", import.meta.url)));
  assert.match(read("../.gitignore"), /\.env\.\*/);
});
