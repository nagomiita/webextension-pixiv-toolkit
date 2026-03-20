import GlobalSettings from "@/modules/GlobalSettings";
import AbstractDownloadTask from "../AbstractDownloadTask";
import browser from "@/modules/Extension/browser";
import Downloader from "@/modules/Net/Downloader";
import NameFormatter from "@/modules/Util/NameFormatter";
import MimeType from "@/modules/Util/MimeType";
import pathjoin from "@/modules/Util/pathjoin";

/**
 * @typedef VideoDownloadTaskOptions
 * @property {string} id
 * @property {string} url
 * @property {string} videoUrl
 * @property {string} renameRule
 * @property {any} context
 *
 * @class
 */
class VideoDownloadTask extends AbstractDownloadTask {
  /**
   * @inheritdoc
   */
  type = 'TWITTER_VIDEO';

  /**
   * @type {VideoDownloadTaskOptions}
   */
  options;

  /**
   * @type {Downloader}
   */
  downloader;

  /**
   * @param {VideoDownloadTaskOptions} options
   */
  constructor(options) {
    super();

    this.id = options.id;
    this.url = options.url;
    this.title = options.context.title;
    this.context = options.context;
    this.options = options;

    this.downloader = new Downloader({ processors: 1 });
    this.downloader.appendFile(options.videoUrl);
    this.downloader.addListener('start', this.onStart, this);
    this.downloader.addListener('progress', this.onProgress, this);
    this.downloader.addListener('item-finish', this.onItemFinish, this);
    this.downloader.addListener('finish', this.onFinish, this);
    this.downloader.addListener('item-error', this.onItemError, this);
    this.downloader.addListener('pause', this.onPause, this);
  }

  onStart() {
    //
  }

  /**
   * @param {{progress: number}} param0
   */
  onProgress({ progress }) {
    this.progress = progress;
    this.dispatch('progress', [this.progress]);
  }

  /**
   * @param {{blob: Blob, mimeType: string}} param0
   */
  async onItemFinish({ blob, mimeType }) {
    let nameFormatter = NameFormatter.getFormatter({ context: this.context });
    let ext = MimeType.getExtenstion(mimeType) || 'mp4';
    let url = URL.createObjectURL(blob);

    this.lastDownloadId = await browser.runtime.sendMessage({
      to: 'ws',
      action: 'download:saveFile',
      args: {
        url,
        filename: pathjoin(GlobalSettings().downloadRelativeLocation, nameFormatter.format(
          this.options.renameRule
        )) + '.' + ext
      }
    });

    URL.revokeObjectURL(url);
  }

  async onFinish() {
    this.changeState(this.COMPLETE_STATE);
    this.dispatch('complete');
  }

  /**
   * @param {*} error
   */
  onItemError(error) {
    this.lastError = error;
    this.dispatch('error');
  }

  onPause() {
    this.dispatch('pause');
  }

  /**
   * @param {VideoDownloadTaskOptions} options
   * @returns {VideoDownloadTask}
   */
  static create(options) {
    return new VideoDownloadTask(options);
  }

  /**
   * @override
   * @param {boolean} reset
   */
  async start(reset = false) {
    if (reset) {
      this.downloader.reset();
    }

    if (this.isPending()) {
      this.changeState(this.DOWNLOADING_STATE);
      this.dispatch('start');
      this.downloader.download();
    }
  }

  /**
   * @override
   */
  pause() {
    this.changeState(this.PAUSED_STATE);

    if (this.downloader) {
      this.downloader.pause();
    }
  }

  /**
   * @override
   */
  stop() {
    if (this.downloader) {
      this.downloader.pause();
    }
  }
}

export default VideoDownloadTask;
