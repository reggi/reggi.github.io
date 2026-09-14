import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const main = await readFile(new URL("../src/app/main.js", import.meta.url), "utf8");
const css = await readFile(new URL("../src/core/styles.css", import.meta.url), "utf8");
const data = JSON.parse(await readFile(new URL("../src/app/projects.json", import.meta.url), "utf8"));
const generatedData = JSON.parse(
  await readFile(new URL("../src/app/project-data.generated.json", import.meta.url), "utf8"),
);
const syncScript = await readFile(new URL("../scripts/sync-project-data.mjs", import.meta.url), "utf8");
const viteConfig = await readFile(new URL("../vite.config.js", import.meta.url), "utf8");
const pagesWorkflow = await readFile(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8");
const syncWorkflow = await readFile(new URL("../.github/workflows/sync-project-data.yml", import.meta.url), "utf8");
const familyRepositories = (family) =>
  family.items ? family.items : [family.source, ...family.projects];

test("Vite uses the app and core project structure", () => {
  assert.match(html, /src="\/src\/app\/main\.js"/);
  assert.match(html, /href="\/src\/core\/styles\.css"/);
  assert.match(viteConfig, /base:\s*["']\.\/["']/);
});

test("project data defines valid source-to-project relationships", () => {
  assert.ok(data.families.length > 0);
  assert.ok(data.families.every((family) => family.id !== "knitto"));
  assert.equal(data.profile.siteRepo, "https://github.com/reggi/reggi.github.io");
  const admin = data.families.find((family) => family.id === "admin");
  assert.deepEqual(
    admin.items.map(({ name }) => name),
    ["playbooks", "reggi.github.io"],
  );
  for (const family of data.families) {
    assert.ok(family.id);
    for (const project of familyRepositories(family)) {
      assert.match(project.repo, /^https:\/\/github\.com\/reggi\//);
      if (project.site) assert.match(project.site, /^https:\/\//);
    }
  }
});

test("generated data records Knitto and template versions for every repository", () => {
  const names = data.families.flatMap(familyRepositories).map(({ name }) => name);
  const templatedNames = data.families
    .filter((family) => family.projects?.length > 0)
    .flatMap((family) => [family.source.name, ...family.projects.map(({ name }) => name)]);
  assert.deepEqual(Object.keys(generatedData.repositories).sort(), names.sort());

  for (const name of names) {
    const metadata = generatedData.repositories[name];
    assert.match(metadata.lastUpdated, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(Number.isInteger(metadata.openIssues), true);
    assert.equal(Number.isInteger(metadata.openPullRequests), true);
  }

  for (const name of templatedNames) {
    const metadata = generatedData.repositories[name];
    assert.ok(metadata.knittoVersion, `${name} is missing a Knitto version`);
    assert.ok(metadata.templateVersion, `${name} is missing a template version`);
  }

  for (const name of ["tool-template", "head-2-head-ranking"]) {
    assert.match(generatedData.repositories[name].socialCard, /^\.\/social-cards\/.+\.svg$/);
  }
  assert.equal(
    generatedData.repositories["node-npm-release-map"].socialCard,
    "./screenshots/node-npm-release-map.png",
  );
});

test("the hub renders repository and optional live-site actions", () => {
  assert.match(main, /\["Repository", project\.repo\]/);
  assert.match(main, /\["Live site", project\.site\]/);
  assert.match(main, /family\.projects\.map/);
  assert.doesNotMatch(main, /Projects built in families/);
  assert.doesNotMatch(main, /class="hero"/);
  assert.match(main, /metadata\.knittoVersion/);
  assert.match(main, /metadata\.templateVersion/);
  assert.match(main, /metadata\.lastUpdated/);
  assert.match(main, /metadata\.openIssues/);
  assert.match(main, /metadata\.openPullRequests/);
  assert.match(main, /metadata\?\.socialCard/);
  assert.match(main, /data\.profile\.siteRepo/);
});

test("metadata, dark mode, responsive rules, and focus styles exist", () => {
  for (const marker of ["rel=\"canonical\"", "og:title", "og:description", "twitter:card", "rel=\"icon\""]) {
    assert.ok(html.includes(marker), `Missing ${marker}`);
  }
  assert.match(css, /data-theme="dark"/);
  assert.match(css, /max-width: 620px/);
  assert.match(css, /focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(`${html}\n${main}\n${JSON.stringify(data)}`, /Thomas Reggi/i);
});

test("GitHub Pages builds, tests, and deploys the Vite output", () => {
  assert.match(pagesWorkflow, /npm test/);
  assert.match(pagesWorkflow, /npm run build/);
  assert.match(pagesWorkflow, /actions\/configure-pages@v5/);
  assert.match(pagesWorkflow, /actions\/upload-pages-artifact@v3/);
  assert.match(pagesWorkflow, /path:\s*dist/);
  assert.match(pagesWorkflow, /actions\/deploy-pages@v4/);
});

test("project metadata has a reusable command and weekly sync workflow", () => {
  assert.match(syncScript, /\.knitto\.json/);
  assert.match(syncScript, /template\.json/);
  assert.match(syncScript, /socialCardDirectory/);
  assert.match(syncScript, /captureScreenshot/);
  assert.match(syncWorkflow, /schedule:/);
  assert.match(syncWorkflow, /npm run data:sync/);
  assert.match(syncWorkflow, /git push/);
});
