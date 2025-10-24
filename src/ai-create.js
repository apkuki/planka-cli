import { loadConfig } from './config-loader.js';
import PlankaAPI from './planka-api.js';
import JsonTaskManager from './json-task-manager.js';
import logger from './logger.js';
import { parseDateInput } from './prompt-utils.js';

/**
 * Non-interactive task creation for LLM agents / scripts.
 * input: { title, description, listName|listId, labels: [name|id], subtasks: [string], dueDate: ISO-string }
 * opts: { dryRun: boolean }
 */
export default async function aiCreateTask(input = {}, opts = {}) {
  const dryRun = !!opts.dryRun;

  if (!input || !input.title) throw new Error('Missing required field: title');

  const { config, tasksPath } = loadConfig();
  const planka = new PlankaAPI({ baseURL: config.baseURL, username: config.username, password: config.password, boardId: config.boardId });
  const taskManager = new JsonTaskManager(tasksPath);
  await taskManager.loadTasks();

  await planka.authenticate();

  // Helper: fuzzy match by name (exact -> case-insensitive -> substring -> startsWith)
  const fuzzyFind = (items, nameKey, needle) => {
    if (!items || !needle) return undefined;
    const norm = String(needle).toLowerCase().trim();
    // exact id-like
    let found = items.find(i => (i.id && String(i.id) === needle) || (i[nameKey] && String(i[nameKey]) === needle));
    if (found) return found;
    // case-insensitive exact
    found = items.find(i => i[nameKey] && String(i[nameKey]).toLowerCase() === norm);
    if (found) return found;
    // substring
    found = items.find(i => i[nameKey] && String(i[nameKey]).toLowerCase().includes(norm));
    if (found) return found;
    // startsWith
    found = items.find(i => i[nameKey] && String(i[nameKey]).toLowerCase().startsWith(norm));
    return found;
  };

  // Resolve lists
  let lists = [];
  try { lists = await planka.getLists(); } catch (e) { logger.warn('Could not fetch lists:', e.message); }

  let listId = input.listId;
  if (!listId && input.listName && lists && lists.length) {
    const found = fuzzyFind(lists, 'name', input.listName);
    if (found) listId = found.id || found;
    else {
      // create list
      const created = await planka.createList(config.boardId, input.listName);
      listId = created.id || created._id || created;
    }
  }
  // fallback to first list
  if (!listId && lists && lists.length) listId = lists[0].id || lists[0];

  // Resolve labels to ids, create if missing
  const labelIds = [];
  if (Array.isArray(input.labels) && input.labels.length > 0) {
    let existingLabels = [];
    try { existingLabels = await planka.getLabels(); } catch (e) { logger.warn('Could not fetch labels:', e.message); }
    for (const label of input.labels) {
      if (!label) continue;
      // if label looks like an id (simple heuristic), use it
      if (typeof label === 'string' && /^[0-9a-fA-F\-]{6,}$/.test(label)) {
        labelIds.push(label);
        continue;
      }
      // fuzzy find by name
      const found = fuzzyFind(existingLabels, 'name', label);
      if (found) labelIds.push(found.id || found);
      else {
        const created = await planka.createLabel(config.boardId, { name: String(label), color: 'morning-sky' });
        labelIds.push(created.id || created);
      }
    }
  }

  // Build card payload
  const cardData = {
    title: input.title,
    description: input.description || input.title,
    labelIds
  };
  if (input.dueDate) {
    // accept ISO or natural language
    let d = new Date(input.dueDate);
    if (isNaN(d.getTime())) {
      const parsed = parseDateInput(String(input.dueDate));
      d = parsed ? new Date(parsed) : d;
    }
    if (!isNaN(d.getTime())) cardData.dueDate = d.toISOString();
  }

  if (dryRun) {
    console.log('ℹ️  AI CREATE DRY RUN - would create card with:');
    console.log(JSON.stringify({ listId, cardData, subtasks: input.subtasks || [] }, null, 2));
    return { simulated: true, payload: { listId, cardData } };
  }

  // Create card
  const createdCard = await planka.createCard(listId, cardData);
  const createdCardId = createdCard.id || createdCard._id || createdCard;

  // Create task list and items
  if (Array.isArray(input.subtasks) && input.subtasks.length > 0) {
    const taskList = await planka.createTaskList(createdCardId, 'Tasks');
    const tlistId = taskList.id || taskList._id || taskList;
    for (const st of input.subtasks) {
      await planka.createTaskItem(tlistId, st, false);
    }
  }

  // Persist locally
  const localTask = await taskManager.addTask(input.title, input.description || '', input.subtasks || [], input.labels || []);
  await taskManager.markSynced(localTask.id, createdCardId);

  logger.info(`✅ AI-created card ${createdCardId} and saved local task ${localTask.id}`);
  return { cardId: createdCardId, taskId: localTask.id };
}

export { aiCreateTask };
