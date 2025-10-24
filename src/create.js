import fs from 'fs';
import path from 'path';
import os from 'os';
import JsonTaskManager from './json-task-manager.js';
import PlankaAPI from './planka-api.js';
import logger from './logger.js';
import {
  askForInput,
  selectFromList,
  selectListWithCreateOption,
  selectLabelWithCreateOption,
  selectLabelColor,
  askForSubtasks,
  askForDueDate
} from './prompt-utils.js';

function loadConfigLocal() {
  const globalConfigPath = path.join(os.homedir(), '.planka-cli', 'config.json');
  const globalTasksPath = path.join(os.homedir(), '.planka-cli', 'tasks.json');

  if (!fs.existsSync(globalConfigPath)) {
    throw new Error('No configuration found. Please run `planka config` first.');
  }

  const globalConfig = JSON.parse(fs.readFileSync(globalConfigPath, 'utf8'));
  const currentDir = path.resolve('.');

  let selectedProject = null;
  if (globalConfig.projects) {
    const matchingProject = Object.keys(globalConfig.projects).find(projectDir => currentDir.startsWith(projectDir));
    if (matchingProject) selectedProject = { path: matchingProject, config: globalConfig.projects[matchingProject] };
  }

  const auth = globalConfig.authorization || {};
  const boardConfig = selectedProject ? selectedProject.config : globalConfig.default || {};

  return {
    config: {
      baseURL: auth.PLANKA_API_URL,
      username: auth.PLANKA_USERNAME,
      password: auth.PLANKA_PASSWORD,
      boardId: boardConfig.PLANKA_BOARD_ID
    },
    tasksPath: selectedProject ? path.join(selectedProject.path, 'tasks.json') : globalTasksPath
  };
}

export default async function createTaskCLI(opts = {}) {
  const dryRun = !!opts.dryRun;
  console.log(dryRun ? '✍️  Creating a new task (DRY RUN)...' : '✍️  Creating a new task...');

  // load config
  let cfg;
  try {
    cfg = loadConfigLocal();
  } catch (err) {
    logger.error('❌', err.message);
    return;
  }

  const { config, tasksPath } = cfg;
  const taskManager = new JsonTaskManager(tasksPath);
  await taskManager.loadTasks();

  const planka = new PlankaAPI({ baseURL: config.baseURL, username: config.username, password: config.password, boardId: config.boardId });
  try {
    await planka.authenticate();
  } catch (err) {
    logger.error('❌ Authentication failed — cannot create task:', err.message);
    return;
  }

  // basic prompts
  const title = await askForInput('Enter task title');
  const description = await askForInput('Enter task description (optional)', '');

  // Labels are used instead of category/priority
  const subtasks = await askForSubtasks();
  const dueDate = await askForDueDate();

  // fetch lists from Planka to choose where to create the card
  let lists = [];
  try {
    lists = await planka.getLists();
  } catch (err) {
    logger.warn('⚠️  Could not fetch lists from board — you may need to create one manually');
  }

  let listSelection = { type: 'existing', list: null };
  if (lists && lists.length > 0) {
    listSelection = await selectListWithCreateOption('Select list to add the card to', lists, 'name');
  } else {
    listSelection = { type: 'create_new' };
  }

  let listId = null;
  if (listSelection.type === 'existing') {
    listId = listSelection.list.id || listSelection.list;
  } else {
    const newListName = await askForInput('Enter new list name');
    const created = await planka.createList(config.boardId, newListName);
    listId = created.id || created._id || created;
  }

  // Labels handling
  let labelIds = [];
  try {
    const labels = await planka.getLabels();
    const labelChoice = await selectLabelWithCreateOption('Select a label (or create)', labels, 'name');
    if (labelChoice.type === 'existing') {
      labelIds.push(labelChoice.label.id || labelChoice.label);
    } else if (labelChoice.type === 'create_new') {
      const labelName = await askForInput('Enter new label name');
      const color = await selectLabelColor();
      const labelInfo = { name: labelName, color };
      const createdLabel = await planka.createLabel(config.boardId, labelInfo);
      labelIds.push(createdLabel.id || createdLabel);
    }
  } catch (err) {
    logger.warn('⚠️  Labels unavailable:', err.message);
  }

  // create card
  const cardData = {
    title,
    description,
    tags: [],
    labelIds
  };

  // attach dueDate to card payload if provided (Planka expects ISO8601 date-time string)
  if (dueDate) {
    cardData.dueDate = dueDate;
  }

  try {
    let createdCardId = null;
    if (dryRun) {
      console.log('ℹ️  DRY RUN MODE - would create card with:');
      console.log(JSON.stringify(cardData, null, 2));
      if (subtasks && subtasks.length > 0) {
        console.log('ℹ️  DRY RUN MODE - would create task list and items for subtasks:', subtasks);
      }
  // Persist locally (simulate)
    const localTask = await taskManager.addTask(title, description, subtasks, []);
      console.log(`✅ (DRY) Saved local task: ${title}`);
      return;
    }

    const createdCard = await planka.createCard(listId, cardData);
    createdCardId = createdCard.id || createdCard._id || createdCard;

    // create task list and items for subtasks
    if (subtasks && subtasks.length > 0) {
      const taskList = await planka.createTaskList(createdCardId, 'Tasks');
      const tlistId = taskList.id || taskList._id || taskList;
      for (const st of subtasks) {
        await planka.createTaskItem(tlistId, st, false);
      }
    }

  // Persist locally
  const localTask = await taskManager.addTask(title, description, subtasks, []);
    await taskManager.markSynced(localTask.id, createdCardId);

    console.log(`✅ Created card on Planka and saved local task: ${title}`);
  } catch (err) {
    logger.error('❌ Failed to create card on Planka:', err.response?.data || err.message);
  }
}
