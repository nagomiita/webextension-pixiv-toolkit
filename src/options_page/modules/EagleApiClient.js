const DEFAULT_API_URL = 'http://localhost:41595';
const ALLOWED_BASE_URLS = [
  'http://localhost:41595',
  'http://127.0.0.1:41595'
];

class EagleApiClient {
  baseUrl;

  constructor(baseUrl = DEFAULT_API_URL) {
    this.baseUrl = EagleApiClient.normalizeBaseUrl(baseUrl);
    EagleApiClient.assertAllowedBaseUrl(this.baseUrl);
  }

  static DEFAULT_API_URL = DEFAULT_API_URL;

  static ALLOWED_BASE_URLS = ALLOWED_BASE_URLS;

  static createError(name, message, cause = undefined) {
    const error = new Error(message);
    error.name = name;

    if (cause) {
      error.cause = cause;
    }

    return error;
  }

  static normalizeBaseUrl(baseUrl = DEFAULT_API_URL) {
    const normalized = `${baseUrl || DEFAULT_API_URL}`.trim().replace(/\/+$/g, '');
    return normalized.length > 0 ? normalized : DEFAULT_API_URL;
  }

  static isAllowedBaseUrl(baseUrl = DEFAULT_API_URL) {
    return EagleApiClient.ALLOWED_BASE_URLS.indexOf(
      EagleApiClient.normalizeBaseUrl(baseUrl)
    ) > -1;
  }

  static assertAllowedBaseUrl(baseUrl = DEFAULT_API_URL) {
    if (!EagleApiClient.isAllowedBaseUrl(baseUrl)) {
      throw EagleApiClient.createError(
        'EagleApiUrlNotAllowedError',
        'The Eagle API URL must be http://localhost:41595 or http://127.0.0.1:41595.'
      );
    }
  }

  static unwrapData(payload) {
    if (payload && typeof payload === 'object' && 'data' in payload) {
      return payload.data;
    }

    return payload;
  }

  static extractFolderId(payload) {
    const data = EagleApiClient.unwrapData(payload);

    if (data && typeof data === 'object') {
      return data.id || data.folderId || '';
    }

    return '';
  }

  static extractFolderName(payload) {
    const data = EagleApiClient.unwrapData(payload);

    if (data && typeof data === 'object') {
      return data.name || data.folderName || '';
    }

    return '';
  }

  static extractFolders(payload) {
    const data = EagleApiClient.unwrapData(payload);

    if (Array.isArray(data)) {
      return data;
    }

    if (data && typeof data === 'object') {
      if (Array.isArray(data.items)) {
        return data.items;
      }

      if (Array.isArray(data.folders)) {
        return data.folders;
      }
    }

    return [];
  }

  static flattenFolders(folders, parents = []) {
    let items = [];

    folders.forEach(folder => {
      if (!folder || typeof folder !== 'object') {
        return;
      }

      const name = folder.name || folder.folderName || 'Unnamed';
      const id = folder.id || folder.folderId || name;
      const text = parents.length > 0 ? `${parents.join(' / ')} / ${name}` : name;

      items.push({
        text,
        value: id,
        raw: folder
      });

      const children = Array.isArray(folder.children) ? folder.children :
        (Array.isArray(folder.folders) ? folder.folders : []);

      if (children.length > 0) {
        items = items.concat(EagleApiClient.flattenFolders(children, parents.concat(name)));
      }
    });

    return items;
  }

  static async blobToDataUrl(blob) {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(EagleApiClient.createError(
        'EagleBlobReadError',
        'Failed to convert blob to data URL.'
      ));

      reader.readAsDataURL(blob);
    });
  }

  async request(path, { method = 'GET', body = undefined } = {}) {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const options = {
      method,
      headers: {}
    };

    if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    let response;

    try {
      response = await fetch(url, options);
    } catch (error) {
      throw EagleApiClient.createError(
        'EagleConnectionError',
        'Failed to connect to the Eagle API.',
        error
      );
    }

    let payload = null;

    try {
      payload = await response.json();
    } catch (error) {
      if (response.ok) {
        throw EagleApiClient.createError(
          'EagleInvalidResponseError',
          'The Eagle API returned an invalid response.',
          error
        );
      }
    }

    if (!response.ok) {
      throw EagleApiClient.createError(
        'EagleApiRequestError',
        `The Eagle API request failed with status ${response.status}.`
      );
    }

    if (payload && payload.status && payload.status !== 'success') {
      throw EagleApiClient.createError(
        'EagleApiResponseError',
        payload.message || payload.status || 'The Eagle API returned an error status.'
      );
    }

    return payload;
  }

  async getApplicationInfo() {
    return await this.request('/api/application/info');
  }

  async listFolders() {
    return await this.request('/api/folder/list');
  }

  async createFolder({ folderName, parent = undefined }) {
    const body = { folderName };

    if (parent) {
      body.parent = parent;
    }

    return await this.request('/api/folder/create', {
      method: 'POST',
      body
    });
  }

  async addFromUrls({ items, folderId = undefined }) {
    const body = { items };

    if (folderId) {
      body.folderId = folderId;
    }

    return await this.request('/api/item/addFromURLs', {
      method: 'POST',
      body
    });
  }
}

export default EagleApiClient;
