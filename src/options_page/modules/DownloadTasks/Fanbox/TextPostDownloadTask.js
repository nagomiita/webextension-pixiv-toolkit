import AbstractDownloadTask from "../AbstractDownloadTask";
import GlobalSettings from "@/modules/GlobalSettings";
import FileSystem from "../../FileSystem";
import NameFormatter from "@/modules/Util/NameFormatter";
import pathjoin from "@/modules/Util/pathjoin";

/**
 * @typedef TextPostDownloadTaskOptions
 * @property {string} id
 * @property {string} url
 * @property {string} renameRule
 * @property {any} context
 *
 * @class
 */
class TextPostDownloadTask extends AbstractDownloadTask {
  /**
   * @inheritdoc
   */
  type = 'FANBOX_TEXT_POST';

  /**
   * @type {TextPostDownloadTaskOptions}
   */
  options;

  /**
   *
   * @param {TextPostDownloadTaskOptions} options
   */
  constructor(options) {
    super();

    this.id = options.id;
    this.url = options.url;
    this.state = this.PENDING_STATE;
    this.title = options.context.title;
    this.context = options.context;
    this.options = options;
  }

  /**
   * @param {TextPostDownloadTaskOptions} options
   * @returns {TextPostDownloadTask}
   */
  static create(options) {
    return new TextPostDownloadTask(options);
  }

  async makeTxtFile() {
    let contentParts = [];

    contentParts.push(this.url);
    contentParts.push(this.context.userName);
    contentParts.push(this.title);

    if (this.context.text) {
      contentParts.push(this.context.text);
    }

    let content = contentParts.join("\r\n".repeat(2));
    let url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
    let nameFormatter = NameFormatter.getFormatter({ context: this.context });

    this.lastDownloadId = await FileSystem.getDefault().saveFileInBackground({
      url,
      filename: pathjoin(GlobalSettings().downloadRelativeLocation, nameFormatter.format(
        this.options.renameRule,
        this.context.id + '_' + this.context.title
      )) + '.txt'
    });

    this.changeState(this.COMPLETE_STATE);
    this.dispatch('complete');

    URL.revokeObjectURL(url);
  }

  /**
   * @override
   */
  async start() {
    await this.makeTxtFile();

    this.progress = 1;

    this.dispatch('start');
  }

  /**
   * @override
   */
  pause() {
    //
  }

  /**
   * @override
   */
  stop() {
    //
  }
}

export default TextPostDownloadTask;
