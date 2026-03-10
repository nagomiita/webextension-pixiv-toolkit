import AbstractDownloadTask from "@/options_page/modules/DownloadTasks/AbstractDownloadTask";
import browser from "@/modules/Extension/browser";
import NameFormatter from "@/modules/Util/NameFormatter";
import EagleApiClient from "../EagleApiClient";

class AbstractEagleImportTask extends AbstractDownloadTask {
  options;

  apiClient;

  targetFolderPromise = null;

  importTimestamp = Date.now();

  constructor(options) {
    super();

    this.options = options;
    this.type = options.type || this.type;
    this.id = options.id;
    this.url = options.url;
    this.title = options.context.title;
    this.context = options.context;
    this.apiClient = new EagleApiClient(options.apiUrl);
  }

  getNameFormatter(extraContext = {}) {
    return NameFormatter.getFormatter({
      context: Object.assign({}, this.context, extraContext)
    });
  }

  getWebsiteUrl() {
    return this.context.targetUrl || this.url;
  }

  getWorkFolderName() {
    return this.getNameFormatter().format(this.options.renameRule, this.context.id);
  }

  getModificationTime() {
    return this.importTimestamp;
  }

  buildAnnotation({ pageLabel = undefined } = {}) {
    const lines = [
      `Source: ${this.getWebsiteUrl()}`,
      `Type: ${this.options.resourceType || this.context.type || this.type}`,
      `Title: ${this.context.title || ''}`,
    ];

    if (this.context.userName) {
      lines.push(`Author: ${this.context.userName}${this.context.userId ? ` (${this.context.userId})` : ''}`);
    }

    if (pageLabel) {
      lines.push(`Page: ${pageLabel}`);
    }

    const description = this.context.description || this.context.comment || '';

    if (typeof description === 'string' && description.trim().length > 0) {
      lines.push('');
      lines.push(description.replace(/<br\s*\/?>/ig, '\n').replace(/<\/?[^>]+(>|$)/g, ' ').trim());
    }

    return lines.filter(line => line !== '').join('\n');
  }

  buildTags() {
    const tags = [];
    const websiteUrl = this.getWebsiteUrl();

    if (/fanbox/i.test(websiteUrl)) {
      tags.push('fanbox');
    } else if (/comic\.pixiv/i.test(websiteUrl)) {
      tags.push('pixiv-comic');
    } else if (/pixiv/i.test(websiteUrl)) {
      tags.push('pixiv');
    }

    if (this.options.resourceType) {
      tags.push(this.options.resourceType);
    }

    if (this.context.userName) {
      tags.push(`author:${this.context.userName}`);
    }

    return Array.from(new Set(tags.filter(Boolean)));
  }

  async resolveTargetFolderId(workFolderName = undefined) {
    if (!this.options.eagleCreateWorkFolder) {
      return this.options.eagleBaseFolderId || undefined;
    }

    if (!this.targetFolderPromise) {
      this.targetFolderPromise = this.apiClient.createFolder({
        folderName: workFolderName || this.getWorkFolderName(),
        parent: this.options.eagleBaseFolderId || undefined
      }).then(response => {
        return EagleApiClient.extractFolderId(response) || this.options.eagleBaseFolderId || undefined;
      });
    }

    return await this.targetFolderPromise;
  }

  async importBlob({ blob, name, folderId = undefined, pageLabel = undefined }) {
    const item = {
      url: await EagleApiClient.blobToDataUrl(blob),
      name,
      website: this.getWebsiteUrl(),
    };

    const modificationTime = this.getModificationTime();

    if (modificationTime !== undefined) {
      item.modificationTime = modificationTime;
    }

    return await this.apiClient.addFromUrls({
      items: [item],
      folderId
    });
  }

  async markHistoryImported() {
    await browser.runtime.sendMessage({
      to: 'ws',
      action: 'history:itemEagleImport',
      args: {
        uid: this.options.historyUid,
        title: this.context.title,
        userName: this.context.userName,
        cover: this.context.cover,
        url: this.getWebsiteUrl(),
        type: this.options.resourceType,
        r: this.context.r,
        eagle_imported_at: Math.floor(Date.now() / 1000),
      }
    });
  }

  toJson() {
    return Object.assign({}, super.toJson(), {
      target: 'EAGLE'
    });
  }
}

export default AbstractEagleImportTask;
