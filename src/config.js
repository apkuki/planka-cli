import fs from 'fs';
import path from 'path';
import os from 'os';
import PlankaAPI from './planka-api.js';
import { askForAuthorization, askForInput, selectFromList, askForPassword } from './prompt-utils.js';

export async function configurePlankaCLI() {
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

  // Step 1: Prompt for authorization details (show existing values as defaults)
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
  fs.writeFileSync(globalConfigPath, JSON.stringify(globalConfig, null, 2));
  console.log(`✅ Authorization configuration saved globally to ${globalConfigPath}`);

  // Step 2: Validate connection
  console.log('🔗 Testing connection to Planka...');
  // Create PlankaAPI client with username/password and validate
  let planka = new PlankaAPI({ baseURL: globalConfig.authorization.PLANKA_API_URL, username, password });
  try {
    await planka.authenticate();
    console.log('✅ Connection to Planka successful');
  } catch (error) {
    console.error('❌ Failed to connect to Planka:', error.message || error);
    return;
  }

  // Step 3: Prompt for board configuration
  console.log('📋 Setting up board configuration...');
  const configType = await selectFromList('Create configuration for:', [
    'Global default (applies to all projects)',
    'Project-specific (applies to this folder and subfolders)'
  ]);

  const existingBoard = (globalConfig.default && globalConfig.default.PLANKA_BOARD_ID) || undefined;
  const boardId = await askForInput('Enter Planka Board ID', existingBoard);

  if (configType.startsWith('Global')) {
    globalConfig.default = { PLANKA_BOARD_ID: boardId };
    fs.writeFileSync(globalConfigPath, JSON.stringify(globalConfig, null, 2));
    console.log(`✅ Default board configuration saved globally to ${globalConfigPath}`);
  } else {
    const projectPath = path.resolve('.');
    if (!globalConfig.projects) globalConfig.projects = {};
    globalConfig.projects[projectPath] = { PLANKA_BOARD_ID: boardId };
    fs.writeFileSync(globalConfigPath, JSON.stringify(globalConfig, null, 2));
    console.log(`✅ Project-specific configuration saved for ${projectPath}`);
  }

  // Step 4: Validate connection with board ID using class method
  console.log('🔗 Testing connection with board ID...');
  try {
    planka.boardId = boardId;
    const boardData = await planka.getBoard();
    // boardData may contain item or name depending on endpoint
    const boardName = boardData?.item?.name || boardData?.name || JSON.stringify(boardData);
    console.log(`✅ Connection to board successful! Board name: ${boardName}`);
  } catch (error) {
    console.error('❌ Failed to connect to board:', error.response?.status, error.response?.data || error.message);
    return;
  }

  console.log('🎉 Configuration complete!');
}