import AbstractService from "./AbstractService";
import DownloadManager from "../modules/DownloadManager";
import PageResourceFactory from '@/modules/PageResource/Factory';
import DownloadTaskExistsError from "@/errors/DownloadTaskExistsError";
import EagleImportAdapter from "../modules/EagleImportAdapter";

class EagleService extends AbstractService {
  static instance;

  downloadManager;

  static getService() {
    if (!EagleService.instance) {
      EagleService.instance = new EagleService();
    }

    return EagleService.instance;
  }

  initialize() {
    this.downloadManager = DownloadManager.getDefault();
  }

  async addImport({ unpackedResource, options = {} }) {
    if (!this.application.settings.enableEagleImport) {
      const error = new Error('The Eagle import feature is disabled.');
      error.name = 'EagleImportDisabledError';

      return {
        result: false,
        errorName: error.name
      };
    }

    let pageResource = PageResourceFactory.createPageResource(unpackedResource);
    let importAdapter = EagleImportAdapter.create();
    let importTask;

    try {
      importTask = await importAdapter.createImportTask(pageResource, options);
    } catch (error) {
      return {
        result: false,
        errorName: error.name
      };
    }

    try {
      if (options.redownload) {
        const oldTask = this.downloadManager.getTask(importTask.id);

        if (oldTask.isComplete() || oldTask.isFailure()) {
          this.downloadManager.deleteTask(importTask.id);
        } else {
          throw new DownloadTaskExistsError();
        }
      }

      await this.downloadManager.addTask(importTask);

      return {
        result: true,
        taskId: importTask.id
      };
    } catch (error) {
      return {
        result: false,
        errorName: error.name
      };
    }
  }
}

export default EagleService;
