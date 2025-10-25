# Contributing

Thanks for contributing. This document contains a short, safe process for publishing experimental (alpha) builds with the AI features and alternatives for local testing without publishing.

## Branching model

- `main` / `master`: stable, production-ready code. Only merge here when features are tested and approved.
- `ai`: experimental branch containing AI-related features. Keep this branch separate until the feature is ready for mainstream release.

## Publishing alpha releases (safe, manual process)

We intentionally avoid automated publishes from the `ai` branch. If you want to publish a controlled alpha release, follow these manual steps.

1. Bump the package version in `package.json` to a prerelease version, e.g. `1.3.0-alpha.0`.
2. Commit the change on the `ai` branch and push it to origin.
3. Create a prerelease tag locally and push it:

```pwsh
git tag -a v1.3.0-alpha.0 -m "alpha: 1.3.0-alpha.0"
git push origin v1.3.0-alpha.0
```

4. Publish from a machine you control (manual publish avoids accidental CI publishes):

```pwsh
# on your machine with npm and the proper credentials
npm install
npm publish --tag alpha
```

Notes:
- The `npm publish` command requires an npm automation token for authentication (created on npmjs.com). Do not store tokens in plaintext in the repo.
- If you prefer CI to publish, add an `NPM_TOKEN` secret in GitHub and use a workflow that requires manual approval (e.g., `workflow_dispatch` or a PR label) before publishing. We removed the automated publish workflow to avoid accidental publishes.

## CI-based alpha publish (safer option)

If you want CI to publish, use a GitHub Actions workflow that only runs on manual dispatch or when a maintainer adds a specific label to a PR. Example guard points:

- Only run publishing on `workflow_dispatch` (manual run) OR
- Only run when a PR contains a `publish-alpha` label and a maintainer triggers the workflow.

This ensures someone with permission confirms the release.

## Required tokens and permissions

- NPM automation token: create at https://www.npmjs.com/settings/tokens (choose **Automation**). Save it to GitHub repo secrets under `NPM_TOKEN` if you want CI to publish.
- The token must belong to an npm account that has rights to publish the package name in `package.json`.

## Alternatives to publishing (recommended for testing)

- Local dev with npm link:

```pwsh
npm install
npm link
# use the global `planka` command while developing
planka --help
```

- Install from the `ai` branch (no publish):

```pwsh
npm install github:apkuki/planka-cli#ai
```

- Create a tarball and share it:

```pwsh
npm pack
# produces planka-cli-<version>.tgz which can be installed elsewhere
npm install ./planka-cli-<version>.tgz
```

## Publishing checklist (manual publisher)

- Verify `package.json.name` is correct and you own the npm package name.
- Verify `package.json.version` is a new, unused version.
- Ensure `NPM_TOKEN` (if used in CI) is an automation token with publish scope.
- Prefer manual `npm publish --tag alpha` from a controlled machine when publishing the first alphas.

Thank you — if you want, I can also prepare a sample `workflow_dispatch` workflow template that requires a human to click "Run workflow" in Actions, and only then publishes using the `NPM_TOKEN` secret. Let me know.
# Conventional Commits Guide

This project uses automated versioning based on conventional commits. Your commit messages determine the version bump type.

## Commit Message Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## Types and Version Impact

### 🚀 **feat:** - New features (MINOR version bump)
```bash
git commit -m "feat: add --dry-run flag to create command"
git commit -m "feat(cli): add interactive label selection"
```
**Result:** `0.1.0` → `0.2.0`

### 🐛 **fix:** - Bug fixes (PATCH version bump)
```bash
git commit -m "fix: correct date parsing for German locales"
git commit -m "fix(auth): handle token refresh on 401 errors"
```
**Result:** `0.1.0` → `0.1.1`

### 💥 **BREAKING CHANGE:** - Breaking changes (MAJOR version bump)
```bash
git commit -m "feat!: change config file location to ~/.planka-cli/"
# OR in footer:
git commit -m "feat: change API interface

BREAKING CHANGE: config file moved from .env to ~/.planka-cli/config.json"
```
**Result:** `0.1.0` → `1.0.0`

### 📚 **Other types** (NO version bump)
- **docs:** Documentation changes
- **chore:** Maintenance tasks
- **style:** Code style changes
- **refactor:** Code refactoring
- **test:** Adding tests
- **ci:** CI/CD changes

```bash
git commit -m "docs: update README installation steps"
git commit -m "chore: remove unused dependencies"
git commit -m "style: fix code formatting"
```

## Examples for Your Project

### Adding Features
```bash
# New CLI command
git commit -m "feat: add planka import command with dry-run support"

# New authentication method  
git commit -m "feat(auth): add API token support"

# UI improvements
git commit -m "feat: improve label selection UX with skip-first option"
```

### Bug Fixes
```bash
# Fix functionality
git commit -m "fix: handle empty board lists gracefully"

# Fix user experience
git commit -m "fix: correct password masking on Windows terminals"

# Fix configuration
git commit -m "fix(config): validate board ID before saving"
```

### Documentation/Maintenance
```bash
# No version bump needed
git commit -m "docs: add troubleshooting section to README"
git commit -m "chore: update .gitignore for IDE files"
git commit -m "refactor: extract prompt utilities to separate module"
```

## What Happens Automatically

1. **On every push to master:**
   - GitHub Actions analyzes your commit messages
   - Determines version bump type (major/minor/patch/none)
   - Updates `package.json` version
   - Creates git tag (e.g., `v0.2.0`)
   - Generates GitHub release with changelog
   - Commits version changes back to repo

2. **Generated artifacts:**
   - `CHANGELOG.md` - Auto-generated from commit messages
   - GitHub Releases with release notes
   - Git tags for each version

## Current Setup
- ✅ Automated versioning enabled
- ✅ Conventional commits configured
- ✅ GitHub Actions workflow created
- 🎯 Next commit will trigger first automated release