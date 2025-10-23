import PlankaAPI from './planka-api.js';
import JsonTaskManager from './json-task-manager.js';
import { loadConfig } from './config-loader.js';
import logger from './logger.js';

export default async function importFromPlanka(options = {}) {
  logger.info('📥 Importing missing cards from Planka...');

  if (options.dryRun) {
    logger.info('🧪 DRY RUN MODE - No changes will be made');
  }

  try {
    const { config, tasksPath } = loadConfig();
    const planka = new PlankaAPI(config);
    const taskManager = new JsonTaskManager(tasksPath);
    await taskManager.loadTasks();

  await planka.authenticate();
  logger.info('✅ Authenticated with Planka successfully');

    const cards = await planka.getAllBoardCards();
    const activeCards = cards.filter(card => !card.isArchived);

    if (activeCards.length === 0) {
      logger.info('✅ No cards to import - Planka board is empty.');
      return;
    }

    const missingCards = activeCards.filter(card =>
      !taskManager.tasks.some(task => task.cardId === card.id)
    );

  logger.info(`\n📊 Import Statistics:`);
  logger.info(`   📋 Total Planka cards: ${activeCards.length}`);
  logger.info(`   📝 Existing JSON tasks: ${taskManager.tasks.length}`);
  logger.info(`   📥 Cards to import: ${missingCards.length}`);

    if (missingCards.length === 0) {
      logger.info('✅ Nothing to import - all cards already in JSON!');
      return;
    }

    const cardsByList = {};
    missingCards.forEach(card => {
      const listName = card.listName || 'Unknown';
      if (!cardsByList[listName]) cardsByList[listName] = [];
      cardsByList[listName].push(card);
    });

    logger.info('\n\ud83d\udccb Cards to import by list:');
    Object.entries(cardsByList).forEach(([listName, cards]) => {
      logger.info(`   ${listName}: ${cards.length} cards`);
    });

    if (options.dryRun) {
      console.log('\n\ud83d\udd8d Preview of cards that would be imported:');
      Object.entries(cardsByList).forEach(([listName, cards]) => {
        console.log(`\n   \ud83d\udcc2 ${listName}:`);
        cards.slice(0, 5).forEach(card => {
          console.log(`      • "${card.name}"`);
        });
        if (cards.length > 5) {
          console.log(`      ... and ${cards.length - 5} more`);
        }
      });
      console.log('\n\ud83d\udca1 Run without --dry-run to actually import these cards');
      return;
    }

    let importedCount = 0;
    let errorCount = 0;

    for (const [listName, cards] of Object.entries(cardsByList)) {
  logger.info(`\n\ud83d\udcc2 Importing from ${listName} (${cards.length} cards)...`);
      for (const card of cards) {
        try {
          const task = {
            title: card.name,
            description: card.description || '',
            status: 'todo',
            priority: 'medium',
            category: listName.toLowerCase(),
            cardId: card.id,
            tags: [],
            subtasks: [],
            createdAt: card.createdAt || new Date().toISOString(),
            updatedAt: card.updatedAt || new Date().toISOString()
          };

          if (card.taskLists && card.taskLists.length > 0) {
            for (const taskList of card.taskLists) {
              if (taskList.taskItems && taskList.taskItems.length > 0) {
                for (const taskItem of taskList.taskItems) {
                  task.subtasks.push({
                    id: Date.now() + Math.random(),
                    title: taskItem.name,
                    completed: taskItem.isCompleted,
                    createdAt: taskItem.createdAt || new Date().toISOString()
                  });
                }
              }
            }
          }

          if (task.subtasks.length === 0 && task.description) {
            const markdownTasks = task.description.match(/^[\s]*[-*]\s*\[[ x]\]\s+(.+)$/gm);
            if (markdownTasks) {
              markdownTasks.forEach(markdownTask => {
                const isCompleted = markdownTask.includes('[x]');
                const title = markdownTask.replace(/^[\s]*[-*]\s*\[[ x]\]\s+/, '');
                task.subtasks.push({
                  id: Date.now() + Math.random(),
                  title: title,
                  completed: isCompleted,
                  createdAt: new Date().toISOString()
                });
              });
            }
          }

          taskManager.addTask(task.title, task.description, task.category, task.priority, task.tags);

          const tasks = taskManager.listTasks();
          const addedTask = tasks[tasks.length - 1];
          if (addedTask) {
            addedTask.cardId = task.cardId;
            addedTask.subtasks = task.subtasks;
            addedTask.createdAt = task.createdAt;
            addedTask.updatedAt = task.updatedAt;

            taskManager.saveTasks();
          }

          importedCount++;
          logger.info(`   \u2705 Imported: "${card.name}"`);

          if (task.subtasks.length > 0) {
            logger.info(`      \ud83d\udd8d With ${task.subtasks.length} subtasks`);
          }
        } catch (error) {
          errorCount++;
          logger.error(`   \u274c Failed to import: "${card.name}" - ${error.message}`);
        }
      }
    }

    logger.info(`\n\ud83d\udcca Import Results:`);
    logger.info(`   \u2705 Successfully imported: ${importedCount} cards`);
    logger.info(`   \u274c Failed imports: ${errorCount} cards`);

    if (importedCount > 0) {
      logger.info('\n\ud83d\udca1 Next steps:');
      logger.info('   \ud83d\udccb Review imported tasks with: list');
      logger.info('   \ud83d\udd04 Sync any updates back to Planka with: sync');
    }

  } catch (error) {
    logger.error('❌ Error importing from Planka:', error.message || error);
  }
}
