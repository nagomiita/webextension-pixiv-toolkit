import GlobalSettings from "@/modules/GlobalSettings";
import { TwitterPostDownloadTask as PostDownloadTask, TwitterVideoDownloadTask as VideoDownloadTask } from "@/options_page/modules/DownloadTasks";
import AbstractDownloadTask from "../../DownloadTasks/AbstractDownloadTask";
import AbstractResource from "@/modules/PageResource/AbstractResource";

class PostAdapter {
  /**
   * @type {string} Target page url
   */
  url;

  /**
   * @type {object} Target context data
   */
  context;

  /**
   * @type {Object}
   */
  settings;

  /**
   * @constructor
   * @param {string} url Target page url
   */
  constructor(url) {
    this.url = url;
    this.settings = GlobalSettings();
  }

  /**
   * @param {string} url
   * @returns {PostAdapter}
   */
  static create(url) {
    return new PostAdapter(url);
  }

  /**
   * @param {AbstractResource} resource
   * @param {Object} options
   * @returns {AbstractDownloadTask}
   */
  async createDownloadTask(resource, options) {
    this.context = resource.getContext();
    this.context.targetUrl = this.url;

    // If tweet has video and no images, or user explicitly requests video
    if (this.context.hasVideo && (this.context.pages.length === 0 || options.downloadVideo)) {
      return VideoDownloadTask.create({
        id: resource.getUid() + ':video',
        url: this.url,
        videoUrl: this.context.videos[0].url,
        renameRule: this.settings.twitterVideoRenameRule || '{id}_{userName}',
        context: this.context
      });
    }

    return PostDownloadTask.create({
      id: resource.getUid(),
      url: this.url,
      pages: this.context.pages,
      selectedIndexes: options.selectedIndexes,
      renameRule: this.settings.twitterPostRenameRule || '{id}_{userName}',
      renameImageRule: this.settings.twitterPostRenameImageRule || 'p{pageNum}',
      pageNumberStartWithOne: this.settings.twitterPostPageNumberStartWithOne === -2 ?
                              this.settings.globalTaskPageNumberStartWithOne :
                              this.settings.twitterPostPageNumberStartWithOne,
      pageNumberLength: this.settings.twitterPostPageNumberLength === -2 ?
                        this.settings.globalTaskPageNumberLength :
                        this.settings.twitterPostPageNumberLength,
      context: this.context
    });
  }
}

export default PostAdapter;
