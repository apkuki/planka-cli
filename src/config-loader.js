import fs from 'fs';
import path from 'path';
import os from 'os';

export function loadConfig() {
  const globalConfigPath = path.join(os.homedir(), '.planka-cli', 'config.json');
  const globalTasksPath = path.join(os.homedir(), '.planka-cli', 'tasks.json');

  if (!fs.existsSync(globalConfigPath)) {
    throw new Error('No configuration found. Please run `planka config` first.');
  }

  const globalConfig = JSON.parse(fs.readFileSync(globalConfigPath, 'utf8'));
  const currentDir = path.resolve('.');

  if (globalConfig.projects) {
    const matchingProject = Object.keys(globalConfig.projects).find(projectDir =>
      currentDir.startsWith(projectDir)
    );

    if (matchingProject) {
      const projectCfg = globalConfig.projects[matchingProject];
      const authorization = globalConfig.authorization || {};
      return {
        config: {
          baseURL: authorization.PLANKA_API_URL,
          username: authorization.PLANKA_USERNAME,
          password: authorization.PLANKA_PASSWORD,
          boardId: projectCfg.PLANKA_BOARD_ID
        },
        tasksPath: path.join(matchingProject, 'tasks.json'),
        rawGlobal: globalConfig
      };
    }
  }

  const authorization = globalConfig.authorization || {};
  return {
    config: {
      baseURL: authorization.PLANKA_API_URL,
      username: authorization.PLANKA_USERNAME,
      password: authorization.PLANKA_PASSWORD,
      boardId: (globalConfig.default && globalConfig.default.PLANKA_BOARD_ID)
    },
    tasksPath: globalTasksPath,
    rawGlobal: globalConfig
  };
}

export function loadGlobalRaw() {
  const globalConfigPath = path.join(os.homedir(), '.planka-cli', 'config.json');
  if (!fs.existsSync(globalConfigPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(globalConfigPath, 'utf8'));
  } catch (e) {
    return null;
  }
}
