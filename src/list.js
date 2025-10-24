import JsonTaskManager from './json-task-manager.js';
import { loadConfig } from './config-loader.js';

export default async function listTasksHandler(options = {}) {
  const { tasksPath } = loadConfig();
  const taskManager = new JsonTaskManager(tasksPath);
  await taskManager.loadTasks();

  let tasks;
  if (options.pending) {
    tasks = taskManager.getPendingTasks();
  } else {
    tasks = taskManager.listTasks();
  }

  console.log(`\ud83d\udccb Found ${tasks.length} tasks:`);
  tasks.forEach(task => {
  const status = task.synced ? '\u2705' : '\u23f3';
  const labelsText = task.labels && task.labels.length ? ` [labels: ${task.labels.join(', ')}]` : '';
  console.log(`${status} [${task.id}] ${task.title}${labelsText}`);

    if (task.subtasks && task.subtasks.length > 0) {
      task.subtasks.forEach(subtask => {
        const subStatus = subtask.completed ? '\u2705' : '\u2610';
        console.log(`    ${subStatus} [${subtask.id}] ${subtask.title}`);
      });
    }
  });
}
