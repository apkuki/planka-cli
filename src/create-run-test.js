import fs from 'fs';
import path from 'path';
import os from 'os';
import JsonTaskManager from './json-task-manager.js';
import PlankaAPI from './planka-api.js';

async function loadConfigLocal() {
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

(async function run() {
  console.log('🔬 Running non-interactive create test...');

  let cfg;
  try {
    cfg = await loadConfigLocal();
  } catch (err) {
    console.error('❌', err.message);
    process.exit(1);
  }

  const { config, tasksPath } = cfg;
  const planka = new PlankaAPI({ baseURL: config.baseURL, username: config.username, password: config.password, boardId: config.boardId });

  try {
    await planka.authenticate();
    console.log('✅ Authenticated to Planka');
  } catch (err) {
    console.error('❌ Authentication failed:', err.message);
    process.exit(1);
  }

  try {
    // find or create a list named 'CLI Test List'
    const lists = await planka.getLists();
    let targetList = lists && lists.find(l => l.name && l.name.toLowerCase().includes('cli test'));
    if (!targetList) {
      const created = await planka.createList(config.boardId, 'CLI Test List');
      targetList = { id: created.id || created._id || created };
      console.log('🆕 Created test list');
    } else {
      console.log('📍 Using existing test list:', targetList.name || targetList.id);
    }

    const title = `Automated test task ${Date.now()}`;
    const description = 'This task was created by an automated CLI test.';
    const cardData = { title, description, tags: [], labelIds: [] };

    const createdCard = await planka.createCard(targetList.id || targetList, cardData);
    const createdCardId = createdCard.id || createdCard._id || createdCard;
    console.log('✅ Created card id:', createdCardId);

    const subtasks = ['First automated subtask', 'Second automated subtask'];
    if (subtasks.length > 0) {
      const taskList = await planka.createTaskList(createdCardId, 'Tasks');
      const tlistId = taskList.id || taskList._id || taskList;
      for (const st of subtasks) {
        await planka.createTaskItem(tlistId, st, false);
      }
      console.log(`✅ Created ${subtasks.length} subtasks`);
    }

    // Persist locally
    const taskManager = new JsonTaskManager(tasksPath);
    await taskManager.loadTasks();
    const localTask = await taskManager.addTask(title, description, 'test', 'normal', subtasks, []);
    await taskManager.markSynced(localTask.id, createdCardId);
    console.log('💾 Saved local task and marked synced');

    console.log('🎉 Non-interactive create test completed successfully');
  } catch (err) {
    console.error('❌ Test failed:', err.response?.data || err.message || err);
    process.exit(1);
  }
})();
