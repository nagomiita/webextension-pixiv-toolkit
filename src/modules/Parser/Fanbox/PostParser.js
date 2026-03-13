import { RuntimeError } from "@/errors";
import DateFormatter from "@/modules/Util/DateFormatter";
import Request from "@/modules/Net/Request";

/**
 * @class
 */
class PostParser {
  /**
   * @type {string}
   */
  ARTICLE_TYPE = 'article';

  /**
   * @type {string}
   */
  IMAGE_TYPE = 'image';

  /**
   * @type {string}
   */
  TEXT_TYPE = 'text';

  /**
   * @type {string} Target page url
   */
  url;

  /**
   * @type {Object} Target context data
   */
  context;

  /**
   * @type {Request}
   */
  request;

  /**
   * @constructor
   * @param {string} url Target page url
   */
  constructor(url) {
    this.url = url;
    this.context = {};
  }

  /**
   * Create a parser instance
   * @param {string} url Target page url
   * @returns {PostParser}
   */
  static create(url) {
    return new PostParser(url);
  }

  /**
   * Set url which need to be parsed. Call this method will reset property
   * context
   * @param {string} url
   */
  setUrl(url) {
    this.url = url;
    this.context = {};
  }

  /**
   * Get illust's context data
   * @returns {Object}
   */
  getContext() {
    return this.context;
  }

  /**
   * Parse the post id and creator id out from url
   * @returns {string}
   * @throws {RuntimeError}
   */
  parseUrl(url) {
    let regexes = [
      /^https:\/\/(?:www\.)?fanbox\.cc\/@([a-z\d_-]+)\/posts\/([\d]+)/i,
      /^https:\/\/([a-z\d_-]+\.)?fanbox\.cc\/posts\/([\d]+)/i
    ];

    for (let regex of regexes) {
      let matches = url.match(regex);

      if (matches) {
        this.context.creatorId = matches[1];
        this.context.postId = matches[2];
        return;
      }
    }

    throw new RuntimeError(`Can't parse the post id and creator id out. url: ${this.url}`);
  }

  /**
   * Build the url which will represet post context data
   * @param {string} postId
   * @returns {string}
   */
  buildContextUrl(postId) {
    return `https://api.fanbox.cc/post.info?postId=${postId}`;
  }

  /**
   * Get post's images from context data
   * @param {Object} context
   * @returns {string[]}
   */
  findImages(context) {
    let images = [];

    if (context.type === this.ARTICLE_TYPE) {
      context.body.blocks.forEach(item => {
        if (item.type === 'image' && context.body.imageMap[item.imageId]) {
          images.push(context.body.imageMap[item.imageId].originalUrl);
        }
      });
    } else if (context.type === this.IMAGE_TYPE) {
      context.body.images.forEach(image => {
        images.push(image.originalUrl);
      });
    } else if (context.type === this.TEXT_TYPE) {
      // Text posts have no images
    } else {
      throw new RuntimeError(`Invalid post type. type: ${context.type}`);
    }

    return images;
  }

  /**
   * Extract text content from text-type post
   * @param {Object} context
   * @returns {string}
   */
  findText(context) {
    if (context.type === this.TEXT_TYPE && context.body && context.body.text) {
      return context.body.text;
    }

    if (context.type === this.ARTICLE_TYPE && context.body && context.body.blocks) {
      return context.body.blocks
        .filter(item => item.type === 'p')
        .map(item => item.text || '')
        .join("\n");
    }

    return '';
  }

  /**
   * Make context standard
   * @param {Object} context
   * @returns {Object}
   */
   standardContext(context) {
    let dateFormatter = new DateFormatter(context.publishedDatetime);

    let sContext = {
      id: context.id,
      title: context.title,
      cover: context.coverImageUrl,
      userId: context.user.userId,
      userName: context.user.name,
      year: dateFormatter.getYear(),
      month: dateFormatter.getMonth(),
      day: dateFormatter.getDay(),
      pages: this.findImages(context),
      postType: context.type,
      text: this.findText(context),
      r: context.hasAdultContent,
      __raw: context,
    };

    sContext.totalPages = sContext.pages.length;

    return sContext;
  }

  /**
   * Parse post context data
   * @returns {Promise.<any,Error>}
   */
  parseContext() {
    this.parseUrl(this.url);

    return new Promise((resolve, reject) => {
      this.request = new Request(this.buildContextUrl(this.context.postId), {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      this.request.addListener('onload', data => {
        let textDecoder = new TextDecoder();
        let json = JSON.parse(textDecoder.decode(data));

        if (json && json.body) {
          this.context = this.standardContext(json.body);
          resolve();
        } else {
          reject(new RuntimeError(`Can't fetch fanbox post ${this.context.postId} context`));
        }
      });

      this.request.addListener('onerror', error => {
        reject(error);
      });

      this.request.send();
    });
  }

  /**
   * Abort request
   */
  abort() {
    if (this.request) {
      this.request.abort();
    }
  }
}

export default PostParser;
