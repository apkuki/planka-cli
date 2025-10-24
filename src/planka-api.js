import axios from 'axios';
import logger from './logger.js';

class PlankaAPI {
  constructor(config = {}) {
    this.baseURL = config.baseURL;
    this.username = config.username;
    this.password = config.password;
    this.boardId = config.boardId;
    this.client = axios.create({ baseURL: this.baseURL, timeout: 10000 });
  }

  async authenticate() {
    try {
      if (!this.username || !this.password) {
        throw new Error('No username/password provided for authentication');
      }

      logger.info('Authenticating with Planka...');
      // Request an access token in the response body (do NOT request httpOnly cookie)
      const response = await this.client.post('/access-tokens?withHttpOnlyToken=false', { emailOrUsername: this.username, password: this.password });

      if (response && response.status >= 200 && response.status < 300) {
        // Planka returns the access token in response.data.item (string) when not using httpOnly cookie.
        const token = response.data?.item || response.data?.accessToken || response.data?.token;
        if (token) {
          this.token = token;
          // Attach Authorization header for subsequent requests
          this.client.defaults.headers.common = this.client.defaults.headers.common || {};
          this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          logger.info('Authentication successful (token attached)');
          return true;
        }

        // If no token present, still treat 2xx as success (some servers may set cookie instead)
        logger.info('Authentication successful (no token returned)');
        return true;
      }
      logger.warn('Authentication response did not indicate success');
      return false;
    } catch (err) {
      logger.error('Authentication failed:', err.message || err);
      throw err;
    }
  }

  async getBoard() {
    try {
      const res = await this.client.get(`/boards/${this.boardId}`);
      return res.data;
    } catch (err) {
      logger.error('Failed to get board:', err.response?.data || err.message || err);
      throw err;
    }
  }

  async getLists() {
    try {
      const boardData = await this.getBoard();
      const lists = boardData.included?.lists || [];
      return lists
        .filter(l => l && l.name)
        .map(l => ({ id: l.id, name: l.name, position: l.position }))
        .sort((a, b) => (a.position || 0) - (b.position || 0));
    } catch (err) {
      logger.error('Failed to get lists:', err.response?.data || err.message || err);
      throw err;
    }
  }

  async getLabels() {
    try {
      const boardData = await this.getBoard();
      const labels = boardData.included?.labels || [];
      return labels
        .filter(l => l && l.name)
        .map(l => ({ id: l.id, name: l.name, color: l.color, position: l.position || 0 }))
        .sort((a, b) => (a.position || 0) - (b.position || 0));
    } catch (err) {
      logger.error('Failed to get labels:', err.response?.data || err.message || err);
      throw err;
    }
  }

  async createList(boardId, name, position = 65536, type = 'active') {
    try {
      const res = await this.client.post(`/boards/${boardId}/lists`, { type, position, name });
      logger.info(`Created list "${name}" in board ${boardId}`);
      return res.data.item;
    } catch (err) {
      logger.error('Failed to create list:', err.response?.data || err.message || err);
      throw err;
    }
  }

  async createCard(listId, cardData) {
    try {
      const res = await this.client.post(`/lists/${listId}/cards`, { type: 'project', name: cardData.title, description: cardData.description || cardData.title, position: cardData.position || 65536, ...cardData });
      return res.data.item;
    } catch (err) {
      logger.error('Failed to create card:', err.response?.data || err.message || err);
      throw err;
    }
  }

  async updateCard(cardId, updateData) {
    try {
      const res = await this.client.patch(`/cards/${cardId}`, updateData);
      return res.data.item;
    } catch (err) {
      logger.error('Failed to update card:', err.response?.data || err.message || err);
      throw err;
    }
  }

  async createTaskList(cardId, name = 'Tasks', position = 65536) {
    try {
      const res = await this.client.post(`/cards/${cardId}/task-lists`, { name, position, isShownOnCard: true });
      return res.data.item;
    } catch (err) {
      logger.error('Failed to create task list:', err.response?.data || err.message || err);
      throw err;
    }
  }

  async createTaskItem(taskListId, name, isCompleted = false, position = 65536) {
    try {
      const res = await this.client.post(`/task-lists/${taskListId}/tasks`, { name, isCompleted, position });
      return res.data.item;
    } catch (err) {
      logger.error('Failed to create task item:', err.response?.data || err.message || err);
      throw err;
    }
  }

  async deleteTaskList(taskListId) {
    try {
      const res = await this.client.delete(`/task-lists/${taskListId}`);
      return res.data;
    } catch (err) {
      logger.error('Failed to delete task list:', err.response?.data || err.message || err);
      throw err;
    }
  }

  async updateTaskItem(taskItemId, updates) {
    try {
      const res = await this.client.patch(`/task-items/${taskItemId}`, updates);
      return res.data.item;
    } catch (err) {
      logger.error('Failed to update task item:', err.response?.data || err.message || err);
      throw err;
    }
  }

  async getCardDetails(cardId) {
    try {
      const res = await this.client.get(`/cards/${cardId}`);
      return res.data;
    } catch (err) {
      logger.error('Failed to get card details:', err.response?.data || err.message || err);
      throw err;
    }
  }

  async getAllBoardCards() {
    try {
      const boardData = await this.getBoard();
      const cards = boardData.included?.cards || [];
      const lists = boardData.included?.lists || [];
      const taskLists = boardData.included?.taskLists || [];
      const taskItems = boardData.included?.tasks || [];
      const labels = boardData.included?.labels || [];
      const cardLabels = boardData.included?.cardLabels || [];

      const activeCards = cards.filter(c => !c.isArchived);

      return activeCards.map(card => {
        const list = lists.find(l => l.id === card.listId);
        const cardTaskLists = taskLists.filter(tl => tl.cardId === card.id);
        const cardTasks = taskItems.filter(ti => cardTaskLists.some(tl => tl.id === ti.taskListId));
        const cardLabelRelations = cardLabels.filter(cl => cl.cardId === card.id);
        const cardLabelsData = cardLabelRelations.map(clr => labels.find(l => l.id === clr.labelId)).filter(Boolean);

        return {
          ...card,
          listName: list?.name,
          isArchived: card.isArchived || false,
          labels: cardLabelsData,
          taskLists: cardTaskLists.map(tl => ({ ...tl, tasks: cardTasks.filter(t => t.taskListId === tl.id) }))
        };
      });
    } catch (err) {
      logger.error('Failed to get all board cards:', err.response?.data || err.message || err);
      throw err;
    }
  }

  async getAllCardIds() {
    try {
      const boardData = await this.getBoard();
      const allCards = boardData.included?.cards || [];
      return { active: allCards.filter(c => !c.isArchived).map(c => c.id), archived: allCards.filter(c => c.isArchived).map(c => c.id) };
    } catch (err) {
      logger.error('Failed to get card IDs:', err.response?.data || err.message || err);
      throw err;
    }
  }

  async moveCard(cardId, targetListId, position = 65536) {
    try {
      const res = await this.client.patch(`/cards/${cardId}`, { listId: targetListId, position });
      return res.data.item;
    } catch (err) {
      logger.error('Failed to move card:', err.response?.data || err.message || err);
      throw err;
    }
  }

  async deleteCard(cardId) {
    try {
      const res = await this.client.delete(`/cards/${cardId}`);
      return res.data.item;
    } catch (err) {
      logger.error('Failed to delete card:', err.response?.data || err.message || err);
      throw err;
    }
  }

  async createLabel(boardId, labelData) {
    try {
      const res = await this.client.post(`/boards/${boardId}/labels`, { name: labelData.name, color: labelData.color, position: labelData.position || 65536 });
      return res.data.item;
    } catch (err) {
      logger.error('Failed to create label:', err.response?.data || err.message || err);
      throw err;
    }
  }

  async addLabelToCard(cardId, labelId) {
    try {
      const res = await this.client.post(`/cards/${cardId}/card-labels`, { labelId });
      return res.data.item;
    } catch (err) {
      logger.error('Failed to add label to card:', err.response?.data || err.message || err);
      throw err;
    }
  }

  findListByName(boardData, listName) {
    return boardData.included?.lists?.find(l => l.name && l.name.toLowerCase() === String(listName).toLowerCase());
  }
  
}

export default PlankaAPI;