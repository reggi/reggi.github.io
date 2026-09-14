# reggi.github.io

The source for [reggi.github.io](https://reggi.github.io/), a directory of related templates, tools, and projects.

## Update the directory

Edit [`src/app/projects.json`](src/app/projects.json). Each family has one source repository and any number of related projects. Add a `site` URL only when the project has a working public site.

```json
{
  "name": "project-name",
  "description": "What the project does.",
  "repo": "https://github.com/reggi/project-name",
  "site": "https://reggi.github.io/project-name/"
}
```

Run the metadata sync after changing repositories:

```sh
npm run data:sync
```

The command reads repository activity, `.knitto.json`, package manifests, and template manifests, then writes versions and activity counts to [`src/app/project-data.generated.json`](src/app/project-data.generated.json). Projects with a `socialCard` path have that asset downloaded into `public/social-cards`; projects with a `screenshot` URL get a fresh 1200×630 Chrome capture in `public/screenshots`. A scheduled GitHub Actions workflow runs the same command weekly and commits changes.

## Development

```sh
npm install
npm run dev
```

Run `npm test` and `npm run build` before publishing. Pushes to `main` deploy through GitHub Actions.
