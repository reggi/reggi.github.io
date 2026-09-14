import data from "./projects.json";
import generatedData from "./project-data.generated.json";

const root = document.querySelector("#app");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderActions(project) {
  const links = [
    ["Repository", project.repo],
    ["Live site", project.site],
    ["Package", project.package],
  ].filter(([, url]) => url);

  return links
    .map(
      ([label, url], index) => `
        <a
          class="button${index === 0 ? " primary" : ""}"
          href="${escapeHtml(url)}"
          target="_blank"
          rel="noreferrer"
        >
          ${escapeHtml(label)}
          <span aria-hidden="true">↗</span>
        </a>
      `,
    )
    .join("");
}

function renderVersions(project) {
  const metadata = generatedData.repositories[project.name];
  if (!metadata) return "";

  const versions = [
    metadata.knittoVersion && ["Knitto", metadata.knittoVersion],
    metadata.templateVersion && [metadata.templateName || "Template", metadata.templateVersion],
  ].filter(Boolean);

  if (versions.length === 0) return "";

  return `
    <dl class="version-list" aria-label="Template provenance">
      ${versions
        .map(
          ([label, version]) => `
            <div>
              <dt>${escapeHtml(label)}</dt>
              <dd>${escapeHtml(version)}</dd>
            </div>
          `,
        )
        .join("")}
    </dl>
  `;
}

function renderRepositoryStats(project) {
  const metadata = generatedData.repositories[project.name];
  if (!metadata) return "";

  const updated = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(metadata.lastUpdated));

  return `
    <dl class="repository-stats" aria-label="Repository activity">
      <div>
        <dt>Updated</dt>
        <dd><time datetime="${escapeHtml(metadata.lastUpdated)}">${escapeHtml(updated)}</time></dd>
      </div>
      <div>
        <dt>Issues</dt>
        <dd>${metadata.openIssues}</dd>
      </div>
      <div>
        <dt>PRs</dt>
        <dd>${metadata.openPullRequests}</dd>
      </div>
    </dl>
  `;
}

function renderProject(project, role = "project") {
  const metadata = generatedData.repositories[project.name];
  const preview = metadata?.socialCard
    ? `
      <div class="project-card-preview">
        <img src="${escapeHtml(metadata.socialCard)}" alt="" loading="lazy" />
        <span class="project-label">${escapeHtml(project.label || role)}</span>
      </div>
    `
    : `
      <div class="project-card-header">
        <span class="project-mark" aria-hidden="true">${role === "source" ? "&lt;/&gt;" : "◆"}</span>
        <span class="project-label">${escapeHtml(project.label || role)}</span>
      </div>
    `;

  return `
    <article class="project-card ${role === "source" ? "source-card" : ""}">
      ${preview}
      <div class="project-card-body">
        <h3>${escapeHtml(project.name)}</h3>
        <p>${escapeHtml(project.description)}</p>
        ${renderVersions(project)}
        ${renderRepositoryStats(project)}
        <div class="project-card-actions">${renderActions(project)}</div>
      </div>
    </article>
  `;
}

function renderFamily(family) {
  if (family.items) {
    return `
      <section class="family" id="${escapeHtml(family.id)}" aria-labelledby="${escapeHtml(family.id)}-title">
        <header class="family-header">
          <div>
            <span class="eyebrow">${escapeHtml(family.eyebrow)}</span>
            <h2 id="${escapeHtml(family.id)}-title">${escapeHtml(family.name)}</h2>
          </div>
          <p>${escapeHtml(family.description)}</p>
        </header>
        <div class="collection-grid">
          ${family.items.map((project) => renderProject(project)).join("")}
        </div>
      </section>
    `;
  }

  const hasRelatedProjects = family.projects.length > 0;

  return `
    <section class="family" id="${escapeHtml(family.id)}" aria-labelledby="${escapeHtml(family.id)}-title">
      <header class="family-header">
        <div>
          <span class="eyebrow">${escapeHtml(family.eyebrow)}</span>
          <h2 id="${escapeHtml(family.id)}-title">${escapeHtml(family.name)}</h2>
        </div>
        <p>${escapeHtml(family.description)}</p>
      </header>
      ${
        hasRelatedProjects
          ? `<div class="relationship">
        <div class="source-column">
          <span class="column-label">Source</span>
          ${renderProject(family.source, "source")}
        </div>
        <div class="relationship-arrow" aria-hidden="true">
          <span></span>
          <strong>${family.projects.length}</strong>
        </div>
        <div class="projects-column">
          <span class="column-label">Related ${family.projects.length === 1 ? "project" : "projects"}</span>
          <div class="project-grid">
            ${family.projects.map((project) => renderProject(project)).join("")}
          </div>
        </div>
      </div>`
          : `<div class="standalone-grid">${renderProject(family.source, "source")}</div>`
      }
    </section>
  `;
}

root.innerHTML = `
  <div class="app">
    <header class="topbar">
      <a class="brand" href="/" aria-label="${escapeHtml(data.profile.handle)} home">
        <span class="hub-mark" aria-hidden="true">
          <i></i><i></i><i></i><i></i>
        </span>
        <span class="brand-divider"></span>
        <span class="brand-copy">
          <strong>${escapeHtml(data.profile.handle)}</strong>
          <span>projects</span>
        </span>
      </a>
      <nav class="family-nav" aria-label="Project families">
        ${data.families
          .map((family) => `<a href="#${escapeHtml(family.id)}">${escapeHtml(family.name)}</a>`)
          .join("")}
      </nav>
      <div class="global-actions">
        <label class="theme-control">
          <span>Theme</span>
          <select id="themeSelect" aria-label="Color theme">
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <a class="button" href="${escapeHtml(data.profile.siteRepo)}" target="_blank" rel="noreferrer">
          This repo <span aria-hidden="true">↗</span>
        </a>
      </div>
    </header>

    <main id="projects">
      <div class="families">
        ${data.families.map(renderFamily).join("")}
      </div>
    </main>

    <footer>
      <p>Maintained at <a href="${escapeHtml(data.profile.github)}">github.com/${escapeHtml(data.profile.handle)}</a>.</p>
      <div class="footer-links">
        <a href="${escapeHtml(data.profile.siteRepo)}">Source</a>
        <a href="#projects">Back to top ↑</a>
      </div>
    </footer>
  </div>
`;

const themeSelect = document.querySelector("#themeSelect");
const storedTheme = localStorage.getItem("reggi-home-theme") || "system";
themeSelect.value = storedTheme;

function applyTheme(preference) {
  const dark =
    preference === "dark" ||
    (preference === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.toggleAttribute("data-theme", dark);
}

themeSelect.addEventListener("change", () => {
  localStorage.setItem("reggi-home-theme", themeSelect.value);
  applyTheme(themeSelect.value);
});

matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (themeSelect.value === "system") applyTheme("system");
});
