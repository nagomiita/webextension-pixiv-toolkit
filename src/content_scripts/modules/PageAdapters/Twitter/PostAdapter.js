import { TwitterPostParser } from "@/modules/Parser";
import { TwitterPostResource } from "@/modules/PageResource";
import AbstractAdapter from "@/content_scripts/modules/PageAdapters/AbstractAdapter";

/**
 * @class
 */
class PostAdapter extends AbstractAdapter {
  /**
   * @type {TwitterPostParser}
   */
  parser;

  /**
   * @param {string} url
   */
  constructor(url) {
    super(url);
  }

  /**
   * @param {{url: string}} param0
   * @returns {PostAdapter}
   */
  static getAdapter({ url }) {
    return new PostAdapter(url);
  }

  async getResource() {
    this.parser = TwitterPostParser.create(this.url);
    await this.parser.parseContext();
    let context = this.parser.getContext();

    context.url = this.url;
    return TwitterPostResource.create(context);
  }

  abort() {
    this.parser && this.parser.abort();
  }
}

export default PostAdapter;
