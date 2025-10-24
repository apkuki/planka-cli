# Planka CLI Tool — Usage & Reference

A command-line interface for creating and syncing tasks between a local JSON file and your Planka kanban board.

## Features

- 🎯 **Interactive task creation** with optional description, subtasks, due date, list and label selection
- 🏷️ **Smart categorization** based on title/description keywords (priority defaults to `normal`)
- 💾 **Local JSON task store** at `tasks.json` with sync metadata (plankaCardId, synced flag)
- 📥 **Import cards** from Planka into local JSON
- 🔍 **Dry-run mode** for `create` and `import` to preview without making changes
- 🌍 **Locale-aware date parsing** (accepts formats like `30.10.2025` for German locales)
- 🔐 **Secure authentication** with masked password input and token management

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Authentication](#authentication)  
- [Interactive Create Flow](#interactive-create-flow-step-by-step)
- [Commands & Flags](#commands--flags)
- [Examples](#examples)
- [Contributing](#contributing)
- [Troubleshooting](#troubleshooting)

## Installation

Install locally and (optionally) make the CLI available as a global command:

```bash
# Clone the repository
git clone https://github.com/apkuki/planka-cli.git
cd planka-cli

# Install dependencies  
npm install

# Make CLI available globally (recommended)
npm link
```

After `npm link`, the CLI will be available as the `planka` command. If you haven't linked globally, use `node src/index.js` instead.

## Configuration

The CLI uses a JSON configuration stored in your home directory by default:

Path: `~/.planka-cli/config.json`

Schema (example):

```json
{
  "authorization": {
    "PLANKA_API_URL": "https://your-planka.example.com/api",
    "PLANKA_USERNAME": "you@example.com",
    "PLANKA_PASSWORD": "your-password"
  },
  "default": {
    "PLANKA_BOARD_ID": "1627688731064403116"
  },
  "projects": {
    "C:/path/to/project": {
      "PLANKA_BOARD_ID": "1627688731064403116"
    }
  }
}
```

**Configuration Notes:**
- `authorization` contains credentials used for authentication. Password entry is masked when you run `planka config`.
- `default.PLANKA_BOARD_ID` is used when no per-project override exists.
- `projects` can contain per-project overrides keyed by absolute project path — useful if you maintain multiple boards for different repositories.

## Authentication

On `create`, `import`, and other commands the CLI authenticates with your Planka instance. It prefers an access token returned by Planka during login and attaches it as `Authorization: Bearer <token>` on subsequent requests.

If you provide username/password, the CLI will POST to `/access-tokens?withHttpOnlyToken=false` with `{ emailOrUsername, password }`.

Security note: the config file stores credentials locally — protect your home directory. Consider using per-project config for less privileged environments.

### Quick Start

After installation, configure your Planka connection:

```bash
planka config     # Interactive setup: URL, username, password, board
planka test       # Verify connection
planka create     # Create your first task
```

## Interactive Create Flow (step-by-step)

This documents what happens when you run `planka create`:

1. Prompt: Title (required)
   - You must enter a non-empty title. This becomes the card name on Planka and the local task `title`.
2. Prompt: Description (optional)
   - Free text, multi-line not supported in simple prompt; leave empty to skip.
3. Prompt: Subtasks (optional)
   - Enter comma-separated subtasks or press Enter to skip. Each becomes a task list item on the card.
4. Prompt: Due date (optional, locale-aware)
   - Examples: `tomorrow`, `next friday`, `in 3 days`, or a numeric date in your locale (e.g., `30.10.2025` for de locales). The CLI converts input to an ISO-8601 end-of-day timestamp for Planka.
5. Prompt: Select List
   - The CLI shows the board lists (e.g., To Do, Doing, Done). Pick the list where the new card should be created.
6. Prompt: Select Label
   - Ordering is: (1) Skip (no label), (2) existing labels, (3) Create new label.
   - If you pick create, you are prompted to enter a label name and choose a color.
7. The CLI constructs the card payload (title, description, labelIds, dueDate, etc.).
8. If `--dry-run` is used, the CLI prints the payload and stops.
9. Otherwise, the CLI authenticates and calls the Planka API to create the card and task list items. On success it stores `plankaCardId` in the local task and marks it `synced`.

Edge cases handled:
- If list or label lookups return empty, the CLI offers to create a new list/label.
- If due-date parsing fails, the CLI warns and skips the due date.

## Commands & Flags

### Global Flags
- `--verbose` — Enable detailed logging for debugging

### Primary Commands

| Command | Description | Options |
|---------|-------------|---------|
| `planka config` | Interactive configuration (URL, username, password, board) | |
| `planka test` | Quick authentication check; prints board name and info | |
| `planka create` | Interactive task creation (see flow above) | `--dry-run` |
| `planka import` | Import missing cards from Planka into local JSON | `--dry-run` |
| `planka list` | List local tasks and subtasks | `--category <name>`, `--pending` |

### Command Options
- `--dry-run` — Preview what would be created/imported without making changes
- `--category <name>` — Filter tasks by category (for `list` command)
- `--pending` — Show only unsynced tasks (for `list` command)

## Examples

### Basic Usage

```bash
# First-time setup
planka config

# Create a task interactively
planka create

# Preview what would be created (dry-run)
planka create --dry-run --verbose

# Import existing cards from Planka
planka import

# List all local tasks
planka list

# List only pending (unsynced) tasks
planka list --pending

# Test your connection
planka test --verbose
```

### Typical Workflow

```bash
# 1. Configure once
planka config

# 2. Create tasks as needed
planka create

# 3. Sync existing Planka cards
planka import

# 4. Check what's pending sync
planka list --pending
```

## Contributing

This project uses [automated versioning](CONTRIBUTING.md) with conventional commits. 

### Development Setup

```bash
git clone https://github.com/apkuki/planka-cli.git
cd planka-cli
npm install
npm link  # Makes 'planka' command available locally
```

### Commit Message Format

```bash
feat: new features → minor version bump
fix: bug fixes → patch version bump  
docs: documentation → no version bump
chore: maintenance → no version bump
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## Troubleshooting

**Authentication Issues:**
- Run `planka test --verbose` to see detailed request/response
- Verify `PLANKA_API_URL` and credentials in `~/.planka-cli/config.json`
- Ensure your Planka instance is accessible and running

**Date Parsing Issues:**
- Try ISO format: `YYYY-MM-DD` (e.g., `2025-10-30`)
- Use natural language: `tomorrow`, `next friday`, `in 3 days`
- For numeric dates, use your locale format (e.g., `30.10.2025` for German)

**Command Not Found:**
- Run `npm link` in the project directory to make `planka` globally available
- Or use `node src/index.js` instead of `planka`

**Connection Issues:**
- Check that your Planka API URL ends with `/api`
- Verify network connectivity to your Planka instance
- Check firewall settings if using a local Planka instance

---

**Version:** 0.1.0-beta.1 | **Updated:** October 2025