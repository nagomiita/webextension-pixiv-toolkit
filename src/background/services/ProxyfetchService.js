import AbstractService from "./AbstractService";

class ProxyfetchService extends AbstractService {
  /**
   * Fetch a URL from the background script (bypasses CORS)
   * @param {Object} params
   * @param {string} params.url - URL to fetch
   * @param {Object} [params.options] - fetch options (method, headers, etc.)
   * @returns {Promise<{data: string, status: number, statusText: string}>}
   */
  async fetch(params) {
    let { url, options } = params;

    try {
      let response = await fetch(url, options || {});
      let text = await response.text();

      return {
        data: text,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error) {
      return {
        data: null,
        status: 0,
        statusText: error.message,
      };
    }
  }
}

export default ProxyfetchService;
