#!/usr/bin/env node

import JsonTaskManager from './json-task-manager.js';
import PlankaAPI from './planka-api.js';
import { program } from 'commander';
import { askQuestion, askForInput, selectFromList, selectListWithCreateOption, selectLabelWithCreateOption, selectLabelColor, askForSubtasks, askForDueDate } from './prompt-utils.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { configurePlankaCLI } from './config.js';
import createTaskCLI from './create.js';
import aiCreateTask from './ai-create.js';
import interpretTextToAiCreate from './interpret.js';
import importFromPlanka from './import.js';
import listTasksHandler from './list.js';
import { loadConfig } from './config-loader.js';
import logger, { setVerbose, setSilent } from './logger.js';

program
  .name('planka')
  .description('Planka Task Management CLI Tool')
  .version('1.0.0');

program.option('--verbose', 'Enable verbose debug output');

// enable verbose if requested
if (process.argv.includes('--verbose')) {
  setVerbose(true);
}

program
  .command('test')
  .description('Test connection to Planka')
  .action(async () => {
    try {
      const { config } = loadConfig();
      const planka = new PlankaAPI(config);
      const authenticated = await planka.authenticate();
      if (authenticated) {
        logger.info('✅ Connection to Planka successful!');
        const boards = await planka.getBoard();
        logger.info(`📋 Board: ${boards.item?.name || boards.name || JSON.stringify(boards)}`);
      } else {
        logger.error('❌ Failed to connect to Planka');
        process.exit(1);
      }
    } catch (error) {
      logger.error('❌ Connection failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all tasks in JSON format')
  .option('--pending', 'Show only pending (unsynced) tasks')
  .action(async (options) => {
    await listTasksHandler(options);
  });

program
  .command('create')
  .description('Create a new task (interactive)')
  .option('--dry-run', 'Show what would be created without modifying remote')
  .action(async (options) => {
    await createTaskCLI(options);
  });

program
  .command('ai-create')
  .description('Non-interactive create for AI agents. Provide JSON via --input or stdin')
  .option('-i, --input <file>', 'Path to JSON input file')
  .option('--json <json>', 'Provide JSON input inline (single argument)')
  .option('--title <title>', 'Provide title inline')
  .option('--description <desc>', 'Provide description inline')
  .option('--list <listNameOrId>', 'Target list name or id')
  .option('--labels <csv>', 'Comma-separated label names or ids')
  .option('--subtasks <sep>', 'Subtasks either comma-separated or using `||` as separator')
  .option('--due <dueDate>', 'Due date (ISO or natural language)')
  .option('--schema', 'Print machine-readable schema for ai-create and exit')
  .option('--choices', 'Print schema plus live lists and labels from the configured board (machine-friendly)')
  .option('--dry-run', 'Show what would be created without modifying remote')
  .option('--no-create', 'Do not create missing lists/labels; fail if targets are missing')
  .option('--silent', 'Suppress human-friendly output (useful for machine integrations)')
  .option('--idempotency-key <key>', 'Idempotency key to avoid duplicate creates')
  .option('--json-output', 'Print machine-readable JSON output (success/errors)')
  .action(async (options) => {
    try {
      if (options.silent) setSilent(true);
      // --choices fetches live data from the configured Planka board and prints a
      // machine-readable schema including available lists and labels. This helps
      // LLMs select valid list/label names without trial-and-error.
      if (options.choices) {
        try {
          const { config } = loadConfig();
          const planka = new PlankaAPI({ baseURL: config.baseURL, username: config.username, password: config.password, boardId: config.boardId });
          await planka.authenticate();
          const lists = await planka.getLists().catch(() => []);
          const labels = await planka.getLabels().catch(() => []);

          const schema = {
            title: 'string (required)',
            description: 'string (optional)',
            listName: 'string (optional) - prefer listName over listId',
            listId: 'string (optional)',
            labels: ['string'],
            subtasks: ['string'],
            dueDate: 'string (ISO or natural language)'
          };

          const out = {
            schema,
            lists: (lists || []).map(l => ({ id: l.id || l, name: l.name || String(l) })),
            labels: (labels || []).map(lb => ({ id: lb.id || lb, name: lb.name || String(lb), color: lb.color || null }))
          };

          console.log(JSON.stringify(out, null, 2));
          return;
        } catch (err) {
          console.error('Could not fetch live choices:', err.message || err);
          process.exit(3);
        }
      }
      // --schema prints a minimal JSON schema to help LLMs construct payloads
      if (options.schema) {
        const schema = {
          title: 'string (required)',
          description: 'string (optional)',
          listName: 'string (optional) - prefer listName over listId',
          listId: 'string (optional)',
          labels: ['string'],
          subtasks: ['string'],
          dueDate: 'string (ISO or natural language)'
        };
        console.log(JSON.stringify(schema, null, 2));
        return;
      }

      let data = null;

      if (options.input) {
        const fs = await import('fs');
        data = JSON.parse(fs.readFileSync(options.input, 'utf8'));
      } else if (options.json) {
        data = JSON.parse(options.json);
      } else if (options.title) {
        // build payload from inline flags
        data = {
          title: options.title,
          description: options.description,
          dueDate: options.due,
          listName: options.list,
          labels: options.labels ? options.labels.split(',').map(s => s.trim()).filter(Boolean) : undefined,
          subtasks: options.subtasks ? (options.subtasks.includes('||') ? options.subtasks.split('||').map(s => s.trim()) : options.subtasks.split(',').map(s => s.trim())) : undefined
        };
      } else {
        // read stdin
        const getStdin = async () => {
          const chunks = [];
          for await (const chunk of process.stdin) chunks.push(chunk);
          return Buffer.concat(chunks).toString('utf8');
        };
        const raw = (await getStdin()).trim();
        if (raw) data = JSON.parse(raw);
      }

      if (!data) {
        console.error('No input provided. Use --input <file>, --json '<json>' , inline flags (e.g. --title) or pipe JSON to stdin.');
        process.exit(1);
      }

      // Basic validation before calling network-bound aiCreateTask (helps LLMs get quick feedback)
      try {
        const { validateAiCreateInput } = await import('./ai-create.js');
        validateAiCreateInput(data);
      } catch (vErr) {
        if (options.jsonOutput) console.log(JSON.stringify({ code: 2, errors: [vErr.message || String(vErr)] }));
        console.error('Validation failed:', vErr.message || vErr);
        process.exit(2);
      }

      // Build opts to pass to aiCreateTask
      const taskOpts = {
        dryRun: !!options.dryRun,
        noCreate: !!options.noCreate,
        silent: !!options.silent,
        idempotencyKey: options.idempotencyKey || null
      };

      try {
        const res = await aiCreateTask(data, taskOpts);
        if (options.jsonOutput) {
          console.log(JSON.stringify({ code: 0, result: res }));
        }
        return res;
      } catch (err) {
        if (options.jsonOutput) console.log(JSON.stringify({ code: 1, error: err.message || String(err) }));
        console.error('AI create failed:', err.message || err);
        process.exit(1);
      }
    } catch (err) {
      console.error('AI create failed:', err.message || err);
      process.exit(1);
    }
  });

program
  .command('interpret')
  .description('Interpret free text into an ai-create payload (heuristic)')
  .argument('[text]', 'Free-form text to interpret; if omitted, read from stdin')
  .option('--create', 'Immediately create the inferred task (default: dry-run)')
  .option('--dry-run', 'Do not create, only print inferred payload')
  .option('--no-create', 'Do not auto-create missing lists/labels')
  .option('--silent', 'Suppress human output (machine mode)')
  .option('--json-output', 'Print JSON of inferred payload or result')
  .action(async (text, options) => {
    try {
      let input = text;
      if (!input) {
        // read stdin
        const getStdin = async () => {
          const chunks = [];
          for await (const chunk of process.stdin) chunks.push(chunk);
          return Buffer.concat(chunks).toString('utf8');
        };
        input = (await getStdin()).trim();
      }

      const res = await interpretTextToAiCreate(input, { dryRun: !options.create, create: !!options.create, silent: !!options.silent, jsonOutput: !!options.jsonOutput, noCreate: !!options.noCreate });
      if (options.jsonOutput) console.log(JSON.stringify({ code: 0, result: res }, null, 2));
      else console.log('Inferred payload:', res.payload ? JSON.stringify(res.payload, null, 2) : JSON.stringify(res, null, 2));
      return res;
    } catch (err) {
      console.error('Interpret failed:', err.message || err);
      process.exit(1);
    }
  });

program
  .command('speak')
  .description('Speak a plain sentence to create a Planka task (friendly wrapper around interpret)')
  .argument('[text]', 'Free-form instruction; if omitted, read from stdin')
  .option('--auto', 'Automatically confirm creation (no prompt)')
  .option('--create', 'Create the inferred task (alias for --auto)')
  .option('--no-create', 'Do not auto-create missing lists/labels')
  .option('--silent', 'Suppress human output (machine mode)')
  .option('--json-output', 'Print JSON of inferred payload or result')
  .action(async (text, options) => {
    try {
      let input = text;
      if (!input) {
        const getStdin = async () => {
          const chunks = [];
          for await (const chunk of process.stdin) chunks.push(chunk);
          return Buffer.concat(chunks).toString('utf8');
        };
        input = (await getStdin()).trim();
      }

      if (!input) {
        console.error('No input provided to speak.');
        process.exit(1);
      }

      const dryRun = true;
      const res = await interpretTextToAiCreate(input, { dryRun: true, create: false, silent: !!options.silent, jsonOutput: false, noCreate: !!options.noCreate });
      const payload = res.payload || res;

      // Show friendly summary and ask for confirmation unless auto/create specified
      if (!options.silent && !options.auto && !options.create) {
        console.log('\nI inferred the following task:');
        console.log(`Title: ${payload.title}`);
        if (payload.listName) console.log(`List: ${payload.listName}`);
        if (payload.labels) console.log(`Labels: ${Array.isArray(payload.labels) ? payload.labels.join(', ') : payload.labels}`);
        if (payload.dueDate) console.log(`Due: ${payload.dueDate}`);
        console.log(`Description: ${payload.description?.slice(0,200)}`);
        // If listName is missing or ambiguous, prompt user to choose a list
        if (!payload.listName) {
          try {
            const { config } = loadConfig();
            const planka = new PlankaAPI({ baseURL: config.baseURL, username: config.username, password: config.password, boardId: config.boardId });
            await planka.authenticate();
            const lists = await planka.getLists();
            if (lists && lists.length) {
              const chosen = await selectFromList('Select target list:', lists, 'name');
              payload.listName = chosen.name || chosen;
              console.log(`Using list: ${payload.listName}`);
            }
          } catch (e) {
            // ignore and continue
          }
        }

        const ans = await askQuestion('Create this task? (Y/n): ');
        if (!ans || ans.toLowerCase().startsWith('y')) {
          options.auto = true;
        } else {
          console.log('Aborted. No task created.');
          return;
        }
      }

      if (options.auto || options.create) {
        const createRes = await interpretTextToAiCreate(input, { dryRun: false, create: true, silent: !!options.silent, jsonOutput: !!options.jsonOutput, noCreate: !!options.noCreate });
        if (options.jsonOutput) console.log(JSON.stringify({ code: 0, result: createRes }, null, 2));
        else if (!options.silent) console.log('Created:', createRes);
        return createRes;
      }

      // if we get here, we only printed the inferred payload
      if (options.jsonOutput) console.log(JSON.stringify({ code: 0, result: res }, null, 2));
      return res;
    } catch (err) {
      console.error('Speak failed:', err.message || err);
      process.exit(1);
    }
  });

// config command is provided by ./config.js

program
  .command('import')
  .description('Import all Planka cards that are missing from JSON')
  .option('--dry-run', 'Show what would be imported without actually doing it')
  .action(async (options) => {
    await importFromPlanka(options);
  });

program
  .command('config')
  .description('Configure Planka CLI tool')
  .option('-p, --project', 'Only configure a project-specific board (skip authorization and global default)')
  .option('-a, --auth', 'Only run authorization setup (URL, username, password)')
  .option('-d, --default', 'Only configure the global default board ID')
  .option('--dry-run', 'Show what would be written without changing files')
  .action(async (options) => {
    await configurePlankaCLI(options);
  });

// loadConfig is provided by ./config-loader.js

// Update other commands to use `loadConfig` to retrieve configuration
// Example:
// const config = loadConfig();
// const apiUrl = config.PLANKA_API_URL;

program.parse();