# Planka CLI Tool — Usage & Reference

This README documents what the Planka CLI can do, how to configure authentication (global and per-project), the interactive "create" flow, available commands and flags, and troubleshooting tips.

Target audience: users who want a simple CLI to create planka tasks locally and sync them to a Planka board. Planka is considered the source of truth.

--

Table of contents
- Features
- Configuration (global + per-project)
- Authentication
- Interactive create flow (step-by-step)
- Commands & flags
- Examples
- Troubleshooting

## Features

- Interactive task creation with optional description, subtasks, due date, list selection and label selection.
- Automatic categorization (based on title/description keywords). Priority defaults to `normal` unless provided.
- Local JSON task store at `tasks.json` with sync metadata (plankaCardId, synced flag).
- Import cards from Planka into local JSON.
- Dry-run mode for `create` and `import` to preview payloads without writing to Planka.
- Locale-aware date parsing (accepts local numeric formats like `30.10.2025` for de locales).

## Open possible Iprovements
All Project Management related work like ticking off sub-task, moving cards adding media to cards etc. is done in Planka frontend. For sync reasons (and later improvements) PLanka CLI writes new tasks to a Local .json store and syncs them to Planka. A bidirectional sync can therefore be added in later versions
- adding non-interactive flow, so that task can be generated skripted or by using an LLM calling the function
- adding biderectional support to move task in CLI or tick off subtask while working (coding) in your environment)

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

Notes:
- `authorization` contains credentials used for authentication. Password entry is masked when you run `node src/index.js config`.
- `default.PLANKA_BOARD_ID` is used when no per-project override exists.
- `projects` can contain per-project overrides keyed by absolute project path — useful if you maintain multiple boards for different repositories.

## Authentication

On `create`, `import`, and other commands the CLI authenticates with your Planka instance. It prefers an access token returned by Planka during login and attaches it as `Authorization: Bearer <token>` on subsequent requests.

If you provide username/password, the CLI will POST to `/access-tokens?withHttpOnlyToken=false` with `{ emailOrUsername, password }`.

Security note: the config file stores credentials locally — protect your home directory. Consider using per-project config for less privileged environments.

## Installation

Install locally and (optionally) make the CLI available as a global command.

From the project root:

```powershell
npm install
# Optionally link the package globally so you can call `planka` from anywhere
npm link
```

After `npm link` the CLI will be available as the `planka` command (if your package.json `bin` is set up). Example usages below show the `planka` shortcut; if you haven't linked, use `node src/index.js` instead.

Examples once linked:

```powershell
planka config     # interactive configuration
planka create     # interactive create
planka create --dry-run --verbose
planka import --dry-run
planka list
```

## Interactive create flow (step-by-step)

This documents what happens when you run `node src/index.js create` (or `planka create` if you've linked the CLI).

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

## Commands & flags

Global flags
- `--verbose` — enable detailed logging for debugging.

Primary commands
- `node src/index.js config` — Interactive configuration (base URL, username/password, default board). Shows existing values and accepts Enter to keep them.
- `node src/index.js test` — Quick authentication check; prints board name and basic info.
- `node src/index.js create` — Interactive task creation (described above).
  - `--dry-run` — print payload that would be sent to Planka and do not perform writes.
- `node src/index.js import` — Import missing cards from Planka into local JSON.
  - `--dry-run` — preview what would be imported without performing writes.
- `node src/index.js list` — List local tasks and subtasks.

Internal utilities (not commonly needed):
- `convert-markdown` — convert markdown checkboxes to subtasks (used via `node src/index.js convert-markdown`).

Planned/possible improvements (ask me to implement):
- Non-interactive flags for `create` (e.g., `--title`, `--description`, `--due`, `--list-id`, `--label-ids`) for scripting/CI.

## Examples

Interactive creation (normal):

```powershell
node src/index.js create

# Prompts you through: title, description, subtasks, due date, list, label
```

Dry-run creation (inspect payload):

```powershell
node src/index.js create --dry-run --verbose
```

Import preview:

```powershell
node src/index.js import --dry-run --verbose
```

List tasks:

```powershell
node src/index.js list
```

## Troubleshooting

- Authentication fails: run `node src/index.js test --verbose` to see the exact request/response. Verify `PLANKA_API_URL` and credentials in `~/.planka-cli/config.json`.
- Date parsing: if your numeric date doesn't parse, try ISO `YYYY-MM-DD` or a natural-language token like `tomorrow`.
- Non-interactive automation: piping answers into node prompts can be unreliable (PowerShell/tty behavior). Prefer adding non-interactive flags; I can implement them if you want.

## Contributing

Open for contribution 

---

Updated: October 23, 2025
