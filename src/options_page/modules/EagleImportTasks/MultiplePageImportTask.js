import GlobalSettings from "@/modules/GlobalSettings";
import Downloader from "@/modules/Net/Downloader";
import AbstractEagleImportTask from "./AbstractEagleImportTask";

class MultiplePageImportTask extends AbstractEagleImportTask {
  options;

  downloader;

  constructor(options) {
    super(options);

    this.options = options;
    this.downloader = new Downloader({
      processors: GlobalSettings().downloadTasksWhenDownloadingImages,
      afterItemDownload: this.afterItemDownload.bind(this)
    });

    const pages = Array.isArray(options.pages) ? options.pages : [];

    if (Array.isArray(options.selectedIndexes) && options.selectedIndexes.length > 0) {
      pages.forEach((page, index) => {
        if (options.selectedIndexes.indexOf(index) > -1) {
          this.downloader.appendFile(page, { index });
        }
      });
    } else {
      pages.forEach((page, index) => {
        this.downloader.appendFile(page, { index });
      });
    }

    this.downloader.addListener('start', this.onStart, this);
    this.downloader.addListener('progress', this.onProgress, this);
    this.downloader.addListener('finish', this.onFinish, this);
    this.downloader.addListener('item-error', this.onItemError, this);
    this.downloader.addListener('pause', this.onPause, this);
  }

  static create(options) {
    return new MultiplePageImportTask(options);
  }

  get totalItems() {
    return this.downloader.files.length;
  }

  buildPageNum(pageNum) {
    let number = typeof pageNum === 'number' ? pageNum : parseInt(pageNum, 10);

    if (this.options.pageNumberStartWithOne) {
      number++;
    }

    let pageNumberLength;

    if (this.options.pageNumberLength > 1) {
      pageNumberLength = this.options.pageNumberLength;
    } else if (this.options.pageNumberLength === -1) {
      pageNumberLength = `${this.context.totalPages || this.totalItems || 1}`.length;
    }

    if (pageNumberLength && `${number}`.length < pageNumberLength) {
      return '0'.repeat(pageNumberLength - `${number}`.length) + number;
    }

    return number;
  }

  buildItemName(pageNum) {
    const formatter = this.getNameFormatter({ pageNum });
    const isSingleItem = this.totalItems <= 1;

    if (this.options.eagleCreateWorkFolder) {
      if (isSingleItem) {
        return formatter.format(this.options.renameRule, `${this.context.id}`);
      }

      return formatter.format(this.options.renameImageRule, `p${pageNum}`);
    }

    if (isSingleItem) {
      return formatter.format(this.options.renameRule, `${this.context.id}`);
    }

    const combineRule = GlobalSettings().combinWRRuleAndIRRuleWhenDontCreateWorkFolder === 0 ?
      this.options.renameImageRule :
      `${this.options.renameRule}_${this.options.renameImageRule}`;

    return formatter.format(combineRule, `${this.context.id}-p${pageNum}`);
  }

  onStart() {
    //
  }

  onProgress({ progress }) {
    this.progress = progress;
    this.dispatch('progress', [progress]);
  }

  async afterItemDownload({ itemFinishData }) {
    const pageNum = this.buildPageNum(itemFinishData.args.index);
    const folderId = await this.resolveTargetFolderId(this.getWorkFolderName());

    await this.importBlob({
      blob: itemFinishData.blob,
      name: this.buildItemName(pageNum),
      folderId,
      pageLabel: `${pageNum}/${this.context.totalPages || this.totalItems || 1}`
    });
  }

  async onFinish() {
    this.progress = 1;
    this.changeState(this.COMPLETE_STATE);
    await this.markHistoryImported();
    this.dispatch('complete');
  }

  onItemError(error) {
    this.lastError = error;
    this.changeState(this.FAILURE_STATE);
    this.dispatch('error', [error]);
    this.dispatch('failure');
  }

  onPause() {
    this.dispatch('pause');
  }

  start(reset = false) {
    if (reset) {
      this.downloader.reset();
    }

    if (this.isPending()) {
      this.changeState(this.DOWNLOADING_STATE);
      this.dispatch('start');
      this.downloader.download();
    }
  }

  pause() {
    this.changeState(this.PAUSED_STATE);
    this.downloader.pause();
  }

  stop() {
    this.downloader.pause();
  }
}

export default MultiplePageImportTask;
