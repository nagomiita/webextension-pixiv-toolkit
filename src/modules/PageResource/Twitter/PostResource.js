import AbstractResource from "../AbstractResource";

class PostResource extends AbstractResource {
  /**
   * @type {string}
   */
  static __PACK_NAME__ = 'TWITTER_POST';

  /**
   * @param {Object} context
   */
  constructor(context) {
    super(context);
  }

  /**
   * @param {Object} context
   * @returns {PostResource}
   */
  static create(context) {
    return new PostResource(context);
  }

  /**
   * @returns {string}
   */
  getUid() {
    return 'twitter_post:' + this.getId();
  }

  /**
   * @returns {string}
   */
  getType() {
    return 'twitter_post';
  }

  /**
   * @returns {string}
   */
  packName() {
    return PostResource.__PACK_NAME__;
  }

  /**
   * @returns {boolean}
   */
  hasVideo() {
    return !!this.context.hasVideo;
  }

  /**
   * @returns {Array}
   */
  getVideos() {
    return this.context.videos || [];
  }
}

export default PostResource;
