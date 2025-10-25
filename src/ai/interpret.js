import { loadConfig } from '../config-loader.js';
import PlankaAPI from '../planka-api.js';
import { parseDateInput } from '../prompt-utils.js';
import aiCreateTask from './ai-create.js';
import crypto from 'crypto';
import logger from '../logger.js';

// Small fuzzy find helper (same heuristic as ai-create)
const fuzzyFind = (items = [], nameKey = 'name', needle) => {
  if (!items || !needle) return undefined;
  const norm = String(needle).toLowerCase().trim();
  let found = items.find(i => (i.id && String(i.id) === needle) || (i[nameKey] && String(i[nameKey]) === needle));
  if (found) return found;
  found = items.find(i => i[nameKey] && String(i[nameKey]).toLowerCase() === norm);
  if (found) return found;
  found = items.find(i => i[nameKey] && String(i[nameKey]).toLowerCase().includes(norm));
  if (found) return found;
  found = items.find(i => i[nameKey] && String(i[nameKey]).toLowerCase().startsWith(norm));
  return found;
};

function normalizeTitle(text) {
  if (!text) return '';
  let t = String(text).trim();
  // remove polite leading clauses
  t = t.replace(/^\s*(please|pls|kindly)\b[:,]?\s*/i, '');
  t = t.replace(/^\s*(could you|can you|would you)\b[:,]?\s*/i, '');
  // remove common scaffolding referring to adding a task
  t = t.replace(/^\s*(please\s+)?(add|create|make)\s+(a\s+)?(task|todo)\s+(to\s+my\s+)?(planka\s+board\s*)?(that\s+)?/i, '');
  // collapse whitespace
  t = t.replace(/\s+/g, ' ').trim();
  // Use first sentence up to newline or period as a succinct title
  const firstLine = t.split('\n')[0].trim();
  const m = firstLine.match(/(.{10,120}?)(?:\.|$)/);
  const short = (m && m[1]) ? m[1].trim() : firstLine.slice(0, 80).trim();
  return short;
}

function extractDatePhrase(text) {
  if (!text) return null;
  const lower = String(text).toLowerCase();
  if (lower.includes('end of next week') || lower.includes('end of the next week')) {
    return 'end of next week';
  }
  // look for common date cue words and take nearby words
  const patterns = [ /until\s+[^,\.\n]+/i, /by\s+[^,\.\n]+/i, /due\s+[^,\.\n]+/i, /in\s+\d+\s+days?/i, /next\s+\w+/i, /tomorrow|today/i ];
  for (const p of patterns) {
    const match = text.match(p);
    if (match) return match[0];
  }
  return null;
}

function computeEndOfNextWeek(now = new Date()) {
  const d = new Date(now);
  const currentDay = d.getDay(); // 0 (Sun) - 6
  // days until next Sunday's date (start from next week)
  const daysUntilNextSunday = ((7 - currentDay) % 7) + 7;
  const target = new Date(d);
  target.setDate(d.getDate() + daysUntilNextSunday);
  target.setHours(23, 59, 59, 999);
  return target;
}

function makeIdempotencyKey(title, boardId, listName) {
  const h = crypto.createHash('sha256');
  h.update(String(title || '')); h.update('|'); h.update(String(boardId || '')); h.update('|'); h.update(String(listName || ''));
  return h.digest('hex').slice(0, 24);
}

export default async function interpretTextToAiCreate(text, options = {}) {
  const { dryRun = true, create = false, silent = false, jsonOutput = false, noCreate = false } = options;

  if (!text) {
    throw new Error('No text provided to interpret');
  }

  const { config } = loadConfig();
  const planka = new PlankaAPI({ baseURL: config.baseURL, username: config.username, password: config.password, boardId: config.boardId });
  await planka.authenticate();

  // Fetch lists/labels for matching
  let lists = [];
  let labels = [];
  try { lists = await planka.getLists(); } catch (e) { logger.warn('Could not fetch lists for interpret:', e.message); }
  try { labels = await planka.getLabels(); } catch (e) { logger.warn('Could not fetch labels for interpret:', e.message); }

  // Heuristics
  const title = normalizeTitle(text);
  const description = text;

  const datePhrase = extractDatePhrase(text);
  let dueDate = null;
  if (datePhrase) {
    if (datePhrase === 'end of next week') {
      const computed = computeEndOfNextWeek();
      dueDate = computed.toISOString();
    } else {
      const parsed = parseDateInput(datePhrase);
      if (parsed) {
        parsed.setHours(23,59,59,999);
        dueDate = parsed.toISOString();
      }
    }
  }

  // detect likely labels from keywords
  const lower = text.toLowerCase();
  const guessedLabels = [];
  if (/test|testing|qa|verify/.test(lower)) guessedLabels.push('testing');
  if (/docu|readme|docs/.test(lower)) guessedLabels.push('docs');
  if (/bug|fix|error/.test(lower)) guessedLabels.push('bug');
  if (/llm|ai|gpt|agent/.test(lower)) guessedLabels.push('llm');

  // try to match list name mentioned in text (e.g., 'open llm tasks')
  let targetListName = null;
  const listMatch = lists.length ? fuzzyFind(lists, 'name', text) : null;
  if (listMatch) {
    targetListName = listMatch.name;
  } else {
    // fallback: use default 'open llm tasks' if present
    const fallback = fuzzyFind(lists, 'name', 'open llm tasks');
    if (fallback) targetListName = fallback.name;
  }

  // Match guessed labels to existing labels (by name), but allow creation unless noCreate
  const finalLabels = [];
  for (const gl of guessedLabels) {
    const found = fuzzyFind(labels, 'name', gl);
    if (found) finalLabels.push(found.name || found.id || gl);
    else finalLabels.push(gl);
  }

  const payload = {
    title,
    description,
    listName: targetListName,
    labels: finalLabels.length ? finalLabels : undefined,
    subtasks: undefined,
    dueDate: dueDate || undefined
  };

  const idempotencyKey = makeIdempotencyKey(title, config.boardId, targetListName);
  payload.idempotencyKey = idempotencyKey;

  if (jsonOutput) console.log(JSON.stringify({ inferred: payload }, null, 2));

  if (dryRun && !create) {
    return { simulated: true, payload };
  }

  // If create requested, call aiCreateTask
  if (create) {
    const res = await aiCreateTask(payload, { dryRun: !!dryRun, noCreate: !!noCreate, silent: !!silent, idempotencyKey });
    return res;
  }

  return { simulated: true, payload };
}

export { interpretTextToAiCreate, normalizeTitle, extractDatePhrase, computeEndOfNextWeek };
