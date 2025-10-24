#!/usr/bin/env node

import JsonTaskManager from './json-task-manager.js';
import PlankaAPI from './planka-api.js';
import { program } from 'commander';
import { askForInput, selectFromList, selectListWithCreateOption, selectLabelWithCreateOption, selectLabelColor, askForSubtasks, askForDueDate } from './prompt-utils.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { configurePlankaCLI } from './config.js';
import createTaskCLI from './create.js';
import aiCreateTask from './ai-create.js';
import importFromPlanka from './import.js';
import listTasksHandler from './list.js';
import { loadConfig } from './config-loader.js';
import logger, { setVerbose } from './logger.js';

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
  .option('--dry-run', 'Show what would be created without modifying remote')
  .action(async (options) => {
    try {
      let data = null;
      if (options.input) {
        const fs = await import('fs');
        data = JSON.parse(fs.readFileSync(options.input, 'utf8'));
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
        console.error('No input provided. Use --input <file> or pipe JSON to stdin.');
        process.exit(1);
      }
      await aiCreateTask(data, { dryRun: !!options.dryRun });
    } catch (err) {
      console.error('AI create failed:', err.message || err);
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