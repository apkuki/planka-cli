import { loadConfig } from '../config-loader.js';
import PlankaAPI from '../planka-api.js';
import JsonTaskManager from '../json-task-manager.js';
import logger from '../logger.js';
import { parseDateInput } from '../prompt-utils.js';

/**
 * Non-interactive task creation for LLM agents / scripts.
 * input: { title, description, listName|listId, labels: [name|id], subtasks: [string], dueDate: ISO-string }
 * opts: { dryRun: boolean }
 */
export default async function aiCreateTask(input = {}, opts = {}) {
  const dryRun = !!opts.dryRun;
  const noCreate = !!opts.noCreate;
  const silent = !!opts.silent;
  const idempotencyKey = opts.idempotencyKey || null;

  if (!input || !input.title) throw new Error('Missing required field: title');

  // Run lightweight validation to provide clearer errors early
  validateAiCreateInput(input);

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
  let listCreated = false;
  if (!listId && input.listName && lists && lists.length) {
    const found = fuzzyFind(lists, 'name', input.listName);
    if (found) listId = found.id || found;
    else {
      if (noCreate) throw new Error(`List not found: ${input.listName}`);
      // create list
      const created = await planka.createList(config.boardId, input.listName);
      listId = created.id || created._id || created;
      listCreated = true;
    }
  }
  // fallback to first list
  if (!listId && lists && lists.length) listId = lists[0].id || lists[0];

  // Resolve labels to ids, create if missing
  const labelIds = [];
  const labelsCreated = [];
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
        if (noCreate) throw new Error(`Label not found: ${label}`);
        const created = await planka.createLabel(config.boardId, { name: String(label), color: 'morning-sky' });
        const createdId = created.id || created;
        labelIds.push(createdId);
        labelsCreated.push({ id: createdId, name: String(label) });
      }
    }
  }

  // Build card payload
  const cardData = {
    title: input.title,
    description: input.description || input.title,
    labelIds
  };
  // attach idempotency marker to description if provided
  if (idempotencyKey) {
    cardData.description = `${cardData.description}\n\n[planka-cli:idempotency=${idempotencyKey}]`;
  }
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
    if (!silent) {
      console.log('ℹ️  AI CREATE DRY RUN - would create card with:');
      console.log(JSON.stringify({ listId, cardData, subtasks: input.subtasks || [] }, null, 2));
    }
    return { simulated: true, payload: { listId, cardData } };
  }

  // Idempotency / dedupe: if idempotencyKey provided, search board for existing card
  if (idempotencyKey) {
    try {
      const allCards = await planka.getAllBoardCards();
      const foundByKey = allCards.find(c => c.description && String(c.description).includes(idempotencyKey));
      if (foundByKey) {
        // try to find local task mapping
        const existingLocal = taskManager.tasks.find(t => t.plankaCardId && String(t.plankaCardId) === String(foundByKey.id));
        if (!silent) logger.info(`⏳ Found existing card by idempotency key: ${foundByKey.id}`);
        return { existed: true, cardId: foundByKey.id, localTaskId: existingLocal?.id || null };
      }

      // also dedupe by normalized title+list
      const norm = s => String(s || '').toLowerCase().replace(/\s+/g,' ').replace(/[^a-z0-9 ]/g,'').trim();
      const targetNorm = norm(input.title);
      const foundByTitle = allCards.find(c => norm(c.name) === targetNorm && (c.listId === listId || String(c.listName || '').toLowerCase() === String(input.listName || '').toLowerCase()));
      if (foundByTitle) {
        const existingLocal = taskManager.tasks.find(t => t.plankaCardId && String(t.plankaCardId) === String(foundByTitle.id));
        if (!silent) logger.info(`⏳ Found existing card by title: ${foundByTitle.id}`);
        return { existed: true, cardId: foundByTitle.id, localTaskId: existingLocal?.id || null };
      }
    } catch (e) {
      logger.warn('Idempotency check failed:', e.message || e);
    }
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

  const result = {
    cardId: createdCardId,
    taskId: localTask.id,
    created: { listCreated: !!listCreated, labelsCreated, cardCreated: true }
  };

  if (!silent) logger.info(`✅ AI-created card ${createdCardId} and saved local task ${localTask.id}`);
  return result;
}

export { aiCreateTask };

/**
 * Lightweight runtime validation for ai-create input.
 * Throws Error with explanatory message on invalid input.
 */
export function validateAiCreateInput(input = {}) {
  if (!input || typeof input !== 'object') throw new Error('Input must be an object');
  if (!input.title || typeof input.title !== 'string' || !input.title.trim()) throw new Error('Field "title" is required and must be a non-empty string');

  if (input.description && typeof input.description !== 'string') throw new Error('Field "description" must be a string');

  if (input.listName && typeof input.listName !== 'string') throw new Error('Field "listName" must be a string');
  if (input.listId && typeof input.listId !== 'string') throw new Error('Field "listId" must be a string');

  if (input.labels) {
    if (!Array.isArray(input.labels)) throw new Error('Field "labels" must be an array of strings');
    for (const l of input.labels) if (typeof l !== 'string' || !l.trim()) throw new Error('Each label must be a non-empty string');
  }

  if (input.subtasks) {
    if (!Array.isArray(input.subtasks)) throw new Error('Field "subtasks" must be an array of strings');
    for (const s of input.subtasks) if (typeof s !== 'string' || !s.trim()) throw new Error('Each subtask must be a non-empty string');
  }

  if (input.dueDate && typeof input.dueDate !== 'string') throw new Error('Field "dueDate" must be a string (ISO or natural language)');

  return true;
}
