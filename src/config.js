import fs from 'fs';
import path from 'path';
import os from 'os';
import PlankaAPI from './planka-api.js';
import { askForAuthorization, askForInput, selectFromList, askForPassword, askQuestion } from './prompt-utils.js';
import { findMatchingProjectBoard } from './config-utils.js';

export async function configurePlankaCLI(options = {}) {
  console.log('🔧 Configuring Planka CLI tool...');

  const globalConfigPath = path.join(os.homedir(), '.planka-cli', 'config.json');
  const globalConfigDir = path.dirname(globalConfigPath);

  if (!fs.existsSync(globalConfigDir)) {
    fs.mkdirSync(globalConfigDir, { recursive: true });
  }

  let globalConfig = {};
  if (fs.existsSync(globalConfigPath)) {
    try {
      globalConfig = JSON.parse(fs.readFileSync(globalConfigPath, 'utf8')) || {};
    } catch (e) {
      console.warn('⚠️  Could not parse existing config file, starting fresh');
      globalConfig = {};
    }
  }

  // Determine which steps to run based on options
  const runAuth = !!options.auth;
  const runProject = !!options.project;
  const runDefault = !!options.default;
  const dryRun = !!options.dryRun || !!options['dry-run'] || !!options['dryRun'];

  // If no specific partial flag provided, run full flow
  const isPartial = runAuth || runProject || runDefault;

  const projectPath = path.resolve('.');

  // Step 1: Prompt for authorization details (show existing values as defaults)
  if (!isPartial || runAuth) {
    console.log('🔑 Setting up authorization details...');
    const { baseURL, username, password } = await askForAuthorization(globalConfig.authorization || {});

    // Normalize baseURL: remove any trailing slashes, then ensure it ends with /api
    const normalizedBase = baseURL.replace(/\/+$|\s+$/g, '');
    const apiUrl = normalizedBase.endsWith('/api') ? normalizedBase : `${normalizedBase}/api`;
    // Save auth into config (username/password only)
    globalConfig.authorization = globalConfig.authorization || {};
    globalConfig.authorization.PLANKA_API_URL = apiUrl;
    globalConfig.authorization.PLANKA_USERNAME = username;
    globalConfig.authorization.PLANKA_PASSWORD = password;
    // ensure token key removed if present (if it exists from previous versions)
    // previously supported token key has been removed from the flow
    if (!dryRun) {
      fs.writeFileSync(globalConfigPath, JSON.stringify(globalConfig, null, 2));
      console.log(`✅ Authorization configuration saved globally to ${globalConfigPath}`);
    } else {
      console.log(`(dry-run) Authorization configuration would be saved to ${globalConfigPath}`);
    }
  }

  // Step 2: Validate connection (only if we have authorization info)
  console.log('🔗 Testing connection to Planka...');
  let planka;
  if (globalConfig.authorization && globalConfig.authorization.PLANKA_API_URL && globalConfig.authorization.PLANKA_USERNAME && globalConfig.authorization.PLANKA_PASSWORD) {
    planka = new PlankaAPI({ baseURL: globalConfig.authorization.PLANKA_API_URL, username: globalConfig.authorization.PLANKA_USERNAME, password: globalConfig.authorization.PLANKA_PASSWORD });
    try {
      await planka.authenticate();
      console.log('✅ Connection to Planka successful');
    } catch (error) {
      console.error('❌ Failed to connect to Planka:', error.message || error);
      // If this was an explicit auth-only run, return to avoid continuing
      if (runAuth && !(runDefault || runProject)) return;
    }
  } else {
    console.log('⚠️  Authorization details missing; skipping connection test. Use `planka config --auth` to set authorization.');
    // If user requested connection-dependent steps, they will be handled later with caution
  }

  // Step 3: Prompt for board configuration
  // If running full flow (no flags) or running default/project as requested, handle accordingly
  if (!isPartial || runDefault || runProject) {
    console.log('📋 Setting up board configuration...');

    if (!isPartial) {
      // Full flow: ask whether default or project
      var configType = await selectFromList('Create configuration for:', [
        'Global default (applies to all projects)',
        'Project-specific (applies to this folder and subfolders)'
      ]);
    } else if (runDefault) {
      var configType = 'Global default (applies to all projects)';
    } else if (runProject) {
      var configType = 'Project-specific (applies to this folder and subfolders)';
    }

    // Prefer an existing project-specific board for the current folder (or its parent)
    const existingProjectBoard = findMatchingProjectBoard(globalConfig, projectPath);
    const globalDefaultBoard = (globalConfig.default && globalConfig.default.PLANKA_BOARD_ID) || undefined;
    const existingBoard = configType.startsWith('Global')
      ? globalDefaultBoard
      : existingProjectBoard || globalDefaultBoard;

    // Build a clearer, contextual prompt to avoid confusion between "default" label and global default config
    let promptText;
    if (configType.startsWith('Global')) {
      promptText = existingBoard
        ? `Enter Planka Board ID for global default (hit Enter to keep current default ${existingBoard}): `
        : 'Enter Planka Board ID for global default: ';
    } else {
      if (existingProjectBoard) {
        promptText = `Specific board configuration found, hit Enter to keep project board id (${existingProjectBoard}) or enter a new Board ID. To reset to default config enter "default": `;
      } else if (globalDefaultBoard) {
        promptText = `No specific Board configured found, hit Enter to keep default configuration (${globalDefaultBoard}) or enter new specific Board ID: `;
      } else {
        promptText = 'No specific Board configured found and no global default is set. Enter a Board ID for this project: ';
      }
    }

    const rawAnswer = await askQuestion(promptText);
    const answer = String(rawAnswer || '').trim();

    // Interpret user input: empty -> keep existingBoard; 'default' when project -> remove project-specific override
    let boardId;
    if (!answer) {
      boardId = existingBoard;
    } else if (answer.toLowerCase() === 'default' && configType.startsWith('Project')) {
      // Reset project-specific config to default by deleting the entry (if exists)
      if (globalConfig.projects && globalConfig.projects[projectPath]) {
        if (!dryRun) {
          delete globalConfig.projects[projectPath];
          fs.writeFileSync(globalConfigPath, JSON.stringify(globalConfig, null, 2));
          console.log(`✅ Project-specific configuration for ${projectPath} removed (now using global default)`);
        } else {
          console.log(`(dry-run) Project-specific configuration for ${projectPath} would be removed (now using global default)`);
        }
      } else {
        console.log('⚠️  No project-specific configuration exists to remove.');
      }
      // In either case, consider the effective boardId to be the global default
      boardId = globalDefaultBoard;
    } else {
      boardId = answer;
    }

    if (configType.startsWith('Global')) {
      globalConfig.default = { PLANKA_BOARD_ID: boardId };
      if (!dryRun) {
        fs.writeFileSync(globalConfigPath, JSON.stringify(globalConfig, null, 2));
        console.log(`✅ Default board configuration saved globally to ${globalConfigPath}`);
      } else {
        console.log(`(dry-run) Default board configuration would be saved to ${globalConfigPath}`);
      }
    } else {
      const projectPath = path.resolve('.');
      if (!globalConfig.projects) globalConfig.projects = {};
      globalConfig.projects[projectPath] = { PLANKA_BOARD_ID: boardId };
      if (!dryRun) {
        fs.writeFileSync(globalConfigPath, JSON.stringify(globalConfig, null, 2));
        console.log(`✅ Project-specific configuration saved for ${projectPath}`);
      } else {
        console.log(`(dry-run) Project-specific configuration would be saved for ${projectPath}`);
      }
    }
  }

  // Step 4: Validate connection with board ID using class method
  // Step 4: Optionally validate connection with board ID using class method
  if ((!isPartial || runDefault || runProject) && planka) {
    try {
      console.log('🔗 Testing connection with board ID...');
  // determine last-used boardId (prefer the best-matching project entry, fall back to default)
  const boardIdToTest = findMatchingProjectBoard(globalConfig, projectPath) || (globalConfig.default && globalConfig.default.PLANKA_BOARD_ID);
      if (boardIdToTest) {
        planka.boardId = boardIdToTest;
        const boardData = await planka.getBoard();
        const boardName = boardData?.item?.name || boardData?.name || JSON.stringify(boardData);
        console.log(`✅ Connection to board successful! Board name: ${boardName}`);
      } else {
        console.log('⚠️  No board ID available to test connection.');
      }
    } catch (error) {
      console.error('❌ Failed to connect to board:', error.response?.status, error.response?.data || error.message);
      // don't throw — user may fix later
    }
  }

  console.log('🎉 Configuration complete!');
}