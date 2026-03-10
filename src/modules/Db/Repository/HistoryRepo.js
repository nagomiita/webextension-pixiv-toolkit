import Dexie from 'dexie';
import AbstractRepo from './AbstractRepo';

/**
 * @typedef ItemType
 * @property {string} uid
 * @property {string} title
 * @property {string} cover
 * @property {string} url
 * @property {string} type
 * @property {string} r
 * @property {number} visited_at
 * @property {number} downloaded_at
 * @property {number} eagle_imported_at
 */
class HistoryRepo extends AbstractRepo {
  /**
   * @type {HistoryRepo}
   */
  static instance;

  /**
   *
   * @param {Dexie.Table} table
   * @param {{ max: number }} param1
   */
  constructor(table, { max } = { max: 10000 }) {
    super(table, { max });
  }

  /**
   *
   * @param {Dexie.Table} table
   * @returns {HistoryRepo}
   */
  static getDefault(table) {
    if (!HistoryRepo.instance) {
      HistoryRepo.instance = new HistoryRepo(table);
    }

    return HistoryRepo.instance;
  }

  /**
   * @inheritdoc
   * @param {ItemType} item
   */
  async saveItem(item) {
    let data = {
      uid: item.uid,
      title: item.title,
      url: item.url,
      cover: item.cover,
      userName: item.userName,
      type: item.type,
      r: item.r,
    };

    if (item.visited_at) {
      data.visited_at = item.visited_at;
    }

    if (item.downloaded_at) {
      data.downloaded_at = item.downloaded_at;
    }

    if (item.eagle_imported_at) {
      data.eagle_imported_at = item.eagle_imported_at;
    }

    let foundItem = await this.getItem({ uid: item.uid });

    if (!foundItem) {
      if (data.downloaded_at) {
        data.visited_at = data.downloaded_at;
      } else if (data.eagle_imported_at) {
        data.visited_at = data.eagle_imported_at;
      }

      this.addItem(data);
    } else {
      this.table.update(foundItem.id, data);
    }
  }
}

export default HistoryRepo;
