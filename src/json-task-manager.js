import fs from 'fs/promises';
import path from 'path';
import logger from './logger.js';

class JsonTaskManager {
  constructor(filePath) {
    if (!filePath) {
      throw new Error('Invalid file path for tasks.json');
    }
    this.filePath = filePath;
    this.tasks = [];
    this.lastSync = null;
  }

  /**
   * Load tasks from JSON file
   */
  async loadTasks() {
    try {
      const data = await fs.readFile(this.filePath, 'utf8');
      const json = JSON.parse(data);
      this.tasks = json.tasks || [];
      this.lastSync = json.lastSync;
      return this.tasks;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, create empty structure
        await this.saveTasks();
        return this.tasks;
      }
      throw error;
    }
  }

  /**
   * Save tasks to JSON file
   */
  async saveTasks() {
    if (!this.filePath) {
      throw new Error('Cannot save tasks: file path is undefined');
    }

    const data = {
      tasks: this.tasks,
      lastSync: this.lastSync,
      metadata: {
        version: "1.0.0",
        description: "Task management for Planka integration",
        boardId: process.env.PLANKA_BOARD_ID
      }
    };
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2));
  }

  /**
   * Add a new task
   */
  async addTask(title, description = '', subtasks = [], labels = []) {
    const task = {
      id: Date.now().toString(),
      title,
      description,
      status: 'pending',
      labels: labels || [],
      subtasks: subtasks.map(subtask => ({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        title: subtask,
        completed: false,
        createdAt: new Date().toISOString()
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      plankaCardId: null,
      plankaTaskListId: null,
      synced: false
    };
    
    this.tasks.push(task);
    await this.saveTasks();
    logger.info(`✅ Task added: "${title}"`);
    if (subtasks.length > 0) {
      logger.info(`📝 With ${subtasks.length} subtasks`);
    }
    return task;
  }

  /**
   * Update task status
   */
  async updateTaskStatus(taskId, status) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }
    
    task.status = status;
    task.updatedAt = new Date().toISOString();
  await this.saveTasks();
  logger.info(`✅ Task status updated: "${task.title}" -> ${status}`);
    return task;
  }

  /**
   * Mark task as synced with Planka
   */
  async markSynced(taskId, plankaCardId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }
    
    task.plankaCardId = plankaCardId;
    task.synced = true;
    task.updatedAt = new Date().toISOString();
    await this.saveTasks();
    return task;
  }

  /**
   * Get pending tasks (not yet synced to Planka)
   */
  getPendingTasks() {
    return this.tasks.filter(task => !task.synced);
  }

  /**
   * List all tasks
   */
  listTasks() {
    return this.tasks.map(task => ({
      id: task.id,
      title: task.title,
      status: task.status,
      synced: task.synced,
      subtasks: task.subtasks || [],
      createdAt: task.createdAt
    }));
  }

  /**
   * Add subtask to existing task
   */
  async addSubtask(taskId, subtaskTitle) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }

    if (!task.subtasks) {
      task.subtasks = [];
    }

    const subtask = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      title: subtaskTitle,
      completed: false,
      createdAt: new Date().toISOString()
    };

  task.subtasks.push(subtask);
  task.updatedAt = new Date().toISOString();
  await this.saveTasks();
  logger.info(`📝 Subtask added to "${task.title}": "${subtaskTitle}"`);
    return subtask;
  }

  /**
   * Toggle subtask completion
   */
  async toggleSubtask(taskId, subtaskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }

    const subtask = task.subtasks?.find(st => st.id === subtaskId);
    if (!subtask) {
      throw new Error(`Subtask with ID ${subtaskId} not found`);
    }

    subtask.completed = !subtask.completed;
    task.updatedAt = new Date().toISOString();
  await this.saveTasks();
  logger.info(`${subtask.completed ? '✅' : '⏳'} Subtask "${subtask.title}" marked as ${subtask.completed ? 'completed' : 'pending'}`);
    return subtask;
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId) {
    const index = this.tasks.findIndex(t => t.id === taskId);
    if (index === -1) {
      throw new Error(`Task with ID ${taskId} not found`);
    }
    
    const task = this.tasks[index];
    this.tasks.splice(index, 1);
  await this.saveTasks();
  logger.info(`🗑️ Task deleted: "${task.title}"`);
    return task;
  }

  // Note: category/priority features were removed. Label-based classification is used instead.
}

export default JsonTaskManager;