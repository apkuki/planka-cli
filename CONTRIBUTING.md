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