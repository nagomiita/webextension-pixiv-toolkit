import MultipleDownloadTask from "../MultiplePagesDownloadTask";

/**
 * @class
 */
class PostDownloadTask extends MultipleDownloadTask {
  /**
   * @inheritdoc
   */
  type = 'TWITTER_POST';

  /**
   * @param {import("../MultiplePagesDownloadTask").MultipleDownloadTaskOptions} options
   */
  constructor(options) {
    super(options);
  }

  /**
   * Create a Twitter post image download task
   * @param {any} options
   * @returns {PostDownloadTask}
   */
  static create(options) {
    return new PostDownloadTask(options);
  }
}

export default PostDownloadTask;
