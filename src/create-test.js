import fs from 'fs';
import os from 'os';
import path from 'path';
import JsonTaskManager from './json-task-manager.js';
import PlankaAPI from './planka-api.js';

async function runTestCreate() {
  try {
    const configPath = path.join(os.homedir(), '.planka-cli', 'config.json');
    if (!fs.existsSync(configPath)) {
      console.error('No config found at', configPath);
      process.exit(1);
    }
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const auth = cfg.authorization || {};
    const boardId = (cfg.default && cfg.default.PLANKA_BOARD_ID) || (cfg.projects && Object.values(cfg.projects)[0] && Object.values(cfg.projects)[0].PLANKA_BOARD_ID);
    if (!auth.PLANKA_API_URL || !auth.PLANKA_USERNAME || !auth.PLANKA_PASSWORD) {
      console.error('Incomplete authorization in config');
      process.exit(1);
    }
    if (!boardId) {
      console.error('No boardId configured');
      process.exit(1);
    }

    const baseURL = auth.PLANKA_API_URL;
    const username = auth.PLANKA_USERNAME;
    const password = auth.PLANKA_PASSWORD;

    const planka = new PlankaAPI({ baseURL, username, password, boardId });
    console.log('Authenticating...');
    await planka.authenticate();
    console.log('Authenticated. Getting lists...');
    let lists = [];
    try {
      lists = await planka.getLists();
      console.log('Found lists:', lists.map(l=>l.name));
    } catch (e) {
      console.warn('Could not get lists:', e.message);
    }

    let listId;
    if (lists && lists.length > 0) {
      listId = lists[0].id || lists[0];
      console.log('Using existing list:', lists[0].name);
    } else {
      console.log('No lists found, creating Test List');
      const created = await planka.createList(boardId, 'Test List from CLI');
      listId = created.id || created;
      console.log('Created list id:', listId);
    }

    const title = `Automated test task ${Date.now()}`;
    const description = 'Created by automated test script';
    console.log('Creating card:', title);
    const createdCard = await planka.createCard(listId, { title, description });
    const createdCardId = createdCard.id || createdCard;
    console.log('Created card id:', createdCardId);

    console.log('Creating task list and items...');
    const taskList = await planka.createTaskList(createdCardId, 'Tasks');
    const tlistId = taskList.id || taskList;
    await planka.createTaskItem(tlistId, 'Subtask 1', false);
    await planka.createTaskItem(tlistId, 'Subtask 2', false);
    console.log('Created subtasks');

    // Save locally
    const globalTasksPath = path.join(os.homedir(), '.planka-cli', 'tasks.json');
    const taskManager = new JsonTaskManager(globalTasksPath);
    await taskManager.loadTasks();
    const localTask = await taskManager.addTask(title, description, 'backend', 'normal', ['Subtask 1','Subtask 2'], []);
    await taskManager.markSynced(localTask.id, createdCardId);
    console.log('Local task saved and marked synced');

  } catch (error) {
    console.error('Test create failed:', error.response?.data || error.message || error);
    process.exit(1);
  }
}

runTestCreate();
