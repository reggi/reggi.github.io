import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const owner = "reggi";
const executeFile = promisify(execFile);
const projectFile = new URL("../src/app/projects.json", import.meta.url);
const outputFile = new URL("../src/app/project-data.generated.json", import.meta.url);
const socialCardDirectory = new URL("../public/social-cards/", import.meta.url);
const screenshotDirectory = new URL("../public/screenshots/", import.meta.url);
const projects = JSON.parse(await readFile(projectFile, "utf8"));

const headers = {
  "User-Agent": "reggi-github-home-sync",
};

if (process.env.GITHUB_TOKEN) {
  headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

function repositoryName(repoUrl) {
  const match = repoUrl.match(/github\.com\/[^/]+\/([^/.]+)(?:\.git)?$/);
  if (!match) throw new Error(`Unsupported GitHub repository URL: ${repoUrl}`);
  return match[1];
}

async function fetchContent(repo, path, { required = true, ref = "main" } = {}) {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(ref)}/${path}`;
  const response = await fetch(url, {
    headers: {
      ...headers,
      Accept: "text/plain",
    },
  });

  if (!response.ok) {
    if (!required && response.status === 404) return null;
    throw new Error(`Unable to fetch ${owner}/${repo}/${path} at ${ref}: GitHub returned ${response.status}`);
  }

  return response.text();
}

async function fetchJson(repo, path, options) {
  const content = await fetchContent(repo, path, options);
  if (content === null) return null;

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid JSON in ${owner}/${repo}/${path}`, { cause: error });
  }
}

async function fetchApiJson(url) {
  const response = await fetch(url, {
    headers: {
      ...headers,
      Accept: "application/vnd.github+json",
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch ${url}: GitHub returned ${response.status}`);
  }

  return {
    data: await response.json(),
    link: response.headers.get("link"),
  };
}

function nextPage(link) {
  if (!link) return null;
  const next = link
    .split(",")
    .map((part) => part.trim().match(/^<([^>]+)>;\s*rel="([^"]+)"$/))
    .find((match) => match?.[2] === "next");
  return next?.[1] || null;
}

async function fetchOpenCounts(repo) {
  let url = `https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=100`;
  let issueCount = 0;
  let pullRequestCount = 0;

  while (url) {
    const response = await fetchApiJson(url);
    for (const item of response.data) {
      if (item.pull_request) pullRequestCount += 1;
      else issueCount += 1;
    }
    url = nextPage(response.link);
  }

  return { issueCount, pullRequestCount };
}

async function captureScreenshot(url, repo) {
  await mkdir(screenshotDirectory, { recursive: true });
  const filename = `${repo}.png`;
  const output = fileURLToPath(new URL(filename, screenshotDirectory));
  const candidates = [
    process.env.CHROME_BIN,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
  ].filter(Boolean);

  const errors = [];
  for (const chrome of candidates) {
    try {
      await executeFile(
        chrome,
        [
          "--headless=new",
          "--disable-gpu",
          "--hide-scrollbars",
          "--no-sandbox",
          "--window-size=1200,630",
          "--virtual-time-budget=10000",
          `--screenshot=${output}`,
          url,
        ],
        { timeout: 60000 },
      );
      return `./screenshots/${filename}`;
    } catch (error) {
      errors.push(`${chrome}: ${error.message}`);
    }
  }

  throw new Error(`Unable to capture ${url}. Tried:\n${errors.join("\n")}`);
}

async function resolveTemplate(repo, config) {
  const source = config.source || {};

  if (source.type === "git" && source.url) {
    const sourceRepo = repositoryName(source.url);
    const ref = source.ref || "main";
    const sourcePath = source.path ? `${source.path}/template.json` : "knitto/template.json";
    const manifest = await fetchJson(sourceRepo, sourcePath, { ref });

    return {
      templateName: sourceRepo,
      templateVersion: manifest.release?.version || ref,
      templateRef: ref,
    };
  }

  if (source.type === "local" && source.path) {
    const manifest = await fetchJson(repo, `${source.path}/template.json`);
    return {
      templateName: manifest.name || repo,
      templateVersion: manifest.release?.version || null,
      templateRef: "local",
    };
  }

  return {
    templateName: null,
    templateVersion: null,
    templateRef: null,
  };
}

async function inspectRepository(project) {
  const repo = repositoryName(project.repo);
  const [config, packageManifest, repository, openCounts, socialCard, screenshotPath] = await Promise.all([
    fetchJson(repo, ".knitto.json", { required: false }),
    fetchJson(repo, "package.json", { required: false }),
    fetchApiJson(`https://api.github.com/repos/${owner}/${repo}`).then(({ data }) => data),
    fetchOpenCounts(repo),
    project.socialCard ? fetchContent(repo, project.socialCard) : null,
    project.screenshot ? captureScreenshot(project.screenshot, repo) : null,
  ]);
  const template = config
    ? await resolveTemplate(repo, config)
    : {
        templateName: null,
        templateVersion: null,
        templateRef: null,
      };

  let socialCardPath = null;
  if (socialCard !== null) {
    await mkdir(socialCardDirectory, { recursive: true });
    const extension = project.socialCard.split(".").pop() || "svg";
    const filename = `${repo}.${extension}`;
    await writeFile(new URL(filename, socialCardDirectory), socialCard);
    socialCardPath = `./social-cards/${filename}`;
  }

  return [
    repo,
    {
      knittoVersion: config?.engine?.version || packageManifest?.devDependencies?.knitto || null,
      lastUpdated: repository.pushed_at,
      openIssues: openCounts.issueCount,
      openPullRequests: openCounts.pullRequestCount,
      socialCard: socialCardPath || screenshotPath,
      ...template,
    },
  ];
}

const repositories = projects.families.flatMap((family) =>
  family.items ? family.items : [family.source, ...family.projects],
);
const entries = [];
for (const repository of repositories) {
  entries.push(await inspectRepository(repository));
}
const output = {
  generatedAt: new Date().toISOString(),
  repositories: Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right))),
};

await writeFile(outputFile, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Updated ${entries.length} repositories in src/app/project-data.generated.json`);
