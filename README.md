# Planka CLI Tool — Usage & Reference

A command-line interface for creating and syncing tasks between a local JSON file and your Planka kanban board.

## Features

- 🎯 **Interactive task creation** with optional description, subtasks, due date, list and label selection
- 🏷️ **Label-based classification** (use labels on Planka cards instead of category/priority)
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

# Make the CLI available globally (recommended)
npm link
```

After `npm link`, the CLI will be available as the `planka` command. If you haven't linked globally, use `node src/index.js` instead.

Install via npm (stable vs. alpha)
--------------------------------

This project can be published to npm so users can choose between a stable release and an experimental "AI" release line.

- Package name in this repository: `planka-cli` (see `package.json`).

Stable (recommended for most users):

```pwsh
npm install planka-cli
```

Alpha / experimental (AI features):

When publishing experimental builds from the `ai` branch use a pre-release version and an npm dist-tag (for example `alpha`). This keeps the stable `latest` tag untouched.

```pwsh
# install the alpha dist-tag (published with --tag alpha)
npm install planka-cli@alpha
```

You can also install directly from the GitHub `ai` branch for early testing without publishing to npm:

```pwsh
npm install github:apkuki/planka-cli#ai
```

Developer testing (no publish)
--------------------------------

If you or contributors just want to test the CLI (or the experimental AI features) locally without publishing to npm, use one of these approaches:

- Quick local link (recommended for development):

```pwsh
npm install
npm link
# now the global `planka` command runs your local code
planka --help

# when done, unlink
npm unlink
```

- Install from the `ai` branch (shareable without publishing):

```pwsh
npm install github:apkuki/planka-cli#ai
```

- Pack into a tarball and install elsewhere:

```pwsh
npm pack   # creates planka-cli-<version>.tgz
npm install ./planka-cli-<version>.tgz
```

These approaches avoid publishing and do not require an `NPM_TOKEN` or CI changes.

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
- `projects` can contain per-project configuration overrides keyed by absolute project path — useful if you maintain multiple boards for different repositories.

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
   - Free text — multi-line input is not supported in the simple prompt; leave empty to skip.
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
| `planka config` | Interactive configuration (URL, username, password, board) | `--project`, `--auth`, `--default`, `--dry-run` |
| `planka test` | Quick authentication check; prints board name and info | |
| `planka create` | Interactive task creation (see flow above) | `--dry-run` |
| `planka import` | Import missing cards from Planka into local JSON | `--dry-run` |
| `planka list` | List local tasks and subtasks | `--pending` |

### Command Options
- `--dry-run` — Preview what would be created/imported without making changes
<!-- category filtering removed: labels are used instead -->
- `--pending` — Show only unsynced tasks (for `list` command)

### `planka config` options
- `-p, --project` — Only configure a project-specific board for the current folder (skips the authorization/global default prompts)
- `-a, --auth` — Only run the authorization setup (Planka URL, username, password)
- `-d, --default` — Only configure the global default board ID
- `--dry-run` — Run interactively but do not write any files (shows what would be saved)

## Examples

### Basic Usage

```bash
# First-time setup
planka config

# Create a task interactively
planka create

# Preview what would be created (dry-run)
planka create --dry-run --verbose

# Configure only project-specific board (no auth/global prompts)
planka config --project

# Configure only authorization (URL/username/password)
planka config --auth

# Configure global default board ID only
planka config --default

# Import existing cards from Planka
planka import

# List all local tasks
planka list

# List only pending (unsynced) tasks
planka list --pending

# Test your connection
planka test --verbose
```

## AI / Non-interactive usage

The CLI provides a non-interactive entrypoint `planka ai-create` intended for LLM agents, automation, or scripts. IMPORTANT: the AI features are experimental and considered "alpha" — use the `ai` branch or the `@alpha` npm dist-tag to opt in. Expect the API and behavior to change while this feature is matured.

It accepts a JSON payload (via `--input <file>` or piped to stdin) describing the card to create. The helper will resolve list names and labels (creating them if missing) and persist a local synced task.

JSON schema (example fields):

- title (string, required)
- description (string, optional)
- listName (string) or listId (string) — preferred target list on the board
- labels (array of strings) — label names or ids to add to the card
- subtasks (array of strings) — task items to create on the card
- dueDate (string) — ISO date or short natural language (e.g., "tomorrow", "in 3 days")

Example file `task.json`:

```json
{
   "title": "Write deployment notes",
   "description": "Summarize deployment steps for dapp v2",
   "listName": "To Do",
   "labels": ["Docs", "High Priority"],
   "subtasks": ["Draft notes", "Review with team"],
   "dueDate": "tomorrow"
}
```

Run (dry-run preview):

```powershell
planka ai-create --input task.json --dry-run
# or pipe JSON via stdin:
cat task.json | planka ai-create --dry-run
```

The non-interactive flow uses the same date parsing heuristics as interactive mode and will attempt to match list/label names fuzzily (exact → case-insensitive → substring → startsWith) before creating new ones.

Natural-language examples and the `speak` helper
-------------------------------------------------

In addition to `ai-create`, the repository includes `planka interpret` and a friendly wrapper `planka speak` that accept plain English instructions and attempt to infer an `ai-create` payload. Use these for rapid human or LLM-driven workflows.

Example free-text inputs that the interpreter understands (variants):

- "Add a task to my Planka board for this open point: We need to test the new API before release. Due next Friday, label: ci, list: To Do"
- "Create a card: 'Write deployment notes' in 'open llm tasks' with subtasks 'Draft notes', 'Review with team', due in 3 days"
- "Please create a task to follow up on the design doc; put it in To Do and tag as 'design'"
- "Add task: Fix README — remove category/priority support — due tomorrow — labels: docs, low-priority"

How to use `speak` interactively (friendly confirmation):

```pwsh
# show inferred payload and ask for confirmation
planka speak "Add a task to my Planka board for this open point: We need to test the new API before release. Due next Friday, label: ci, list: To Do"

# auto-confirm and create without prompting
planka speak --auto "Create card: 'CI: add test coverage' list:'open llm tasks' labels:ci,testing due:in 1 week"
```

How to use `interpret` for programmatic flows (dry-run by default):

```pwsh
# infer payload and print JSON (no create)
planka interpret "Create a card 'Write release notes' in To Do with labels docs,release due next Monday" --json-output

# infer and create immediately
planka interpret --create "Create a card 'Trial AI feature' in open llm tasks labels:ai,demo due in 2 days"
```

Machine-friendly usage for LLM agents
------------------------------------

To make it easy for an LLM or automation to create tasks without writing a temporary file, `planka ai-create` provides several options:

- `--schema` — prints a minimal JSON schema to stdout (machine-readable) so an agent can request and follow the exact field names and types.
- `--json '<json>'` — provide the full JSON payload as a single CLI argument (careful with shell quoting).
- Inline flags (shell-friendly): `--title`, `--description`, `--list`, `--labels`, `--subtasks`, `--due`.

Label and subtask parsing notes:
- `--labels` accepts a comma-separated list of label names (e.g. `--labels "llm,automation"`).
- `--subtasks` accepts either comma-separated values or a `||` separated string when commas are expected inside items (e.g. `--subtasks "Draft notes||Review with team"`).

LLM-friendly examples
---------------------

1) Query schema (recommended first step for an LLM):

```powershell
planka ai-create --schema
```

This prints a minimal JSON schema like:

```json
{
   "title": "string (required)",
   "description": "string (optional)",
   "listName": "string (optional)",
   "listId": "string (optional)",
   "labels": ["string"],
   "subtasks": ["string"],
   "dueDate": "string (ISO or natural language)"
}
```

2) Single-line inline creation (no temp file):

```powershell
planka ai-create --title "Fix README: remove category/priority" --list "open llm tasks" --labels "llm,automation" --subtasks "Remove category refs||Update examples" --due "in 1 week"
```

3) Provide JSON inline (careful about shell-quoting):

```powershell
planka ai-create --json '{"title":"Write release notes","listName":"To Do","labels":["docs"]}'
```

4) Or pipe JSON via stdin (already supported):

```powershell
echo '{"title":"CI: add tests","listName":"open llm tasks","labels":["ci"]}' | planka ai-create
```

Recommendation for LLM integrators
----------------------------------

1. Call `planka ai-create --schema` to get the exact field names.
2. Construct a JSON object matching the schema programmatically.
3. Use `--json '<json>'` or inline flags to call `planka ai-create` without creating a temp file.

The CLI performs basic validation and will return short, machine-friendly error codes (exit code 2 for validation errors) so an agent can retry or reformat its payload.

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
- If you haven't linked globally, see the Installation section above for how to run the CLI without linking.

**Connection Issues:**
- Check that your Planka API URL ends with `/api`
- Verify network connectivity to your Planka instance
- Check firewall settings if using a local Planka instance

---

**Version:** 0.1.0-beta.1 | **Updated:** October 2025