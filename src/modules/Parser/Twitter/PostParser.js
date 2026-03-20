import { RuntimeError } from "@/errors";
import DateFormatter from "@/modules/Util/DateFormatter";
import Request from "@/modules/Net/Request";
import browser from "@/modules/Extension/browser";

/**
 * @class
 */
class PostParser {
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
   * Known bearer token used by Twitter Web App
   */
  static BEARER_TOKEN = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

  /**
   * Whether the fetch interceptor has been installed
   */
  static interceptorInstalled = false;

  /**
   * Captured tweet data from intercepted fetch responses
   * @type {Map<string, Object>}
   */
  static capturedTweets = new Map();

  /**
   * @constructor
   * @param {string} url Target page url
   */
  constructor(url) {
    this.url = url;
    this.context = {};
  }

  /**
   * @param {string} url
   * @returns {PostParser}
   */
  static create(url) {
    return new PostParser(url);
  }

  /**
   * @param {string} url
   */
  setUrl(url) {
    this.url = url;
    this.context = {};
  }

  /**
   * @returns {Object}
   */
  getContext() {
    return this.context;
  }

  /**
   * Parse username and tweet ID from URL
   * @param {string} url
   * @throws {RuntimeError}
   */
  parseUrl(url) {
    let regexes = [
      /^https:\/\/(www\.)?x\.com\/([a-zA-Z0-9_]+)\/status\/(\d+)/i,
      /^https:\/\/(www\.)?twitter\.com\/([a-zA-Z0-9_]+)\/status\/(\d+)/i,
    ];

    for (let regex of regexes) {
      let matches = url.match(regex);

      if (matches) {
        this.context.username = matches[2];
        this.context.tweetId = matches[3];
        return;
      }
    }

    throw new RuntimeError(`Can't parse tweet ID from url: ${this.url}`);
  }

  /**
   * Get CSRF token from cookies
   * @returns {string}
   */
  getCsrfToken() {
    let cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      let [name, value] = cookie.trim().split('=');
      if (name === 'ct0') {
        return value;
      }
    }
    return '';
  }

  /**
   * Install a fetch interceptor in the page's MAIN world to capture
   * Twitter's own GraphQL responses containing tweet data.
   */
  static installFetchInterceptor() {
    if (PostParser.interceptorInstalled) return;
    PostParser.interceptorInstalled = true;

    // Listen for tweet data posted from the MAIN world interceptor script
    // (twitter-interceptor.js is registered in manifest with "world": "MAIN")
    window.addEventListener('__ptk_tweet_data', (event) => {
      try {
        let data = JSON.parse(event.detail);
        if (data.tweetId && data.tweetResult) {
          PostParser.capturedTweets.set(data.tweetId, data.tweetResult);
        }
      } catch (e) {
        // ignore
      }
    });
  }

  /**
   * Try to get tweet data from the intercepted fetch cache (instant, no waiting)
   * @returns {boolean} true if data was found in cache
   */
  tryFetchFromCache() {
    let tweetId = this.context.tweetId;

    if (PostParser.capturedTweets.has(tweetId)) {
      let tweetResult = PostParser.capturedTweets.get(tweetId);
      this.context = this.standardContextFromGraphQL(tweetResult);
      return true;
    }

    return false;
  }

  /**
   * Wait briefly for tweet data from the page's own API calls
   * @param {number} timeoutMs
   * @returns {Promise}
   */
  waitForInterceptedData(timeoutMs = 3000) {
    let tweetId = this.context.tweetId;

    return new Promise((resolve, reject) => {
      let timeout;
      let resolved = false;

      const handler = (event) => {
        try {
          let data = JSON.parse(event.detail);
          if (data.tweetId === tweetId) {
            resolved = true;
            clearTimeout(timeout);
            window.removeEventListener('__ptk_tweet_data', handler);
            this.context = this.standardContextFromGraphQL(data.tweetResult);
            resolve();
          }
        } catch (e) {
          // ignore
        }
      };

      window.addEventListener('__ptk_tweet_data', handler);

      timeout = setTimeout(() => {
        if (!resolved) {
          window.removeEventListener('__ptk_tweet_data', handler);
          reject(new RuntimeError('Timeout waiting for tweet data from page'));
        }
      }, timeoutMs);
    });
  }

  /**
   * Standardize context from GraphQL response
   * @param {Object} tweetResult
   * @returns {Object}
   */
  standardContextFromGraphQL(tweetResult) {
    let legacy = tweetResult.legacy || tweetResult.tweet?.legacy;
    let core = tweetResult.core || tweetResult.tweet?.core;
    let user = core?.user_results?.result?.legacy;

    if (!legacy || !user) {
      throw new RuntimeError(`Can't parse tweet data from GraphQL`);
    }

    let mediaDetails = legacy.extended_entities?.media || legacy.entities?.media || [];
    return this.buildContext(legacy, user, mediaDetails);
  }

  /**
   * Build standardized context from tweet data
   * @param {Object} legacy - Tweet legacy data
   * @param {Object} user - User data
   * @param {Array} mediaDetails - Media array
   * @returns {Object}
   */
  buildContext(legacy, user, mediaDetails) {
    let dateFormatter = new DateFormatter(legacy.created_at);
    let images = this.findImages(mediaDetails);
    let videos = this.findVideos(mediaDetails);

    let fullText = legacy.full_text || legacy.text || '';
    let title = fullText.replace(/https?:\/\/t\.co\/\S+/g, '').trim();
    if (title.length > 50) {
      title = title.substring(0, 50);
    }
    if (!title) {
      title = `tweet_${legacy.id_str}`;
    }

    let sContext = {
      id: legacy.id_str,
      title: title,
      cover: images[0] || null,
      userId: user.id_str || legacy.user_id_str,
      userName: user.screen_name,
      displayName: user.name,
      year: dateFormatter.getYear(),
      month: dateFormatter.getMonth(),
      day: dateFormatter.getDay(),
      pages: images,
      videos: videos,
      hasVideo: videos.length > 0,
      postType: videos.length > 0 ? 'video' : 'image',
      r: legacy.possibly_sensitive || false,
      __raw: legacy,
    };

    sContext.totalPages = sContext.pages.length;

    return sContext;
  }

  /**
   * Get image URLs in original quality from media
   * @param {Array} mediaDetails
   * @returns {string[]}
   */
  findImages(mediaDetails) {
    if (!mediaDetails) return [];

    return mediaDetails
      .filter(media => media.type === 'photo')
      .map(media => {
        let url = media.media_url_https;
        // Get original quality
        let baseUrl = url.replace(/\?.*$/, '').replace(/\.\w+$/, '');
        let ext = url.match(/\.(\w+)(?:\?|$)/);
        ext = ext ? ext[1] : 'jpg';
        return `${baseUrl}?format=${ext}&name=orig`;
      });
  }

  /**
   * Get highest quality video URL from media
   * @param {Array} mediaDetails
   * @returns {Array<{url: string, bitrate: number}>}
   */
  findVideos(mediaDetails) {
    if (!mediaDetails) return [];

    let videos = [];

    mediaDetails
      .filter(media => media.type === 'video' || media.type === 'animated_gif')
      .forEach(media => {
        if (media.video_info && media.video_info.variants) {
          let mp4Variants = media.video_info.variants
            .filter(v => v.content_type === 'video/mp4')
            .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

          if (mp4Variants.length > 0) {
            videos.push({
              url: mp4Variants[0].url,
              bitrate: mp4Variants[0].bitrate || 0,
            });
          }
        }
      });

    return videos;
  }

  /**
   * Try to fetch using syndication API via background script (bypasses CORS)
   * @returns {Promise}
   */
  async fetchViaSyndication() {
    let syndicationUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${this.context.tweetId}&lang=en&token=x`;

    let response = await browser.runtime.sendMessage({
      to: 'ws',
      action: 'proxyfetch:fetch',
      args: { url: syndicationUrl }
    });

    if (!response || !response.data) {
      throw new RuntimeError(`Syndication API: no response`);
    }

    if (response.status !== 200) {
      throw new RuntimeError(`Syndication API returned status ${response.status}: ${response.data.substring(0, 200)}`);
    }

    let json;
    try {
      json = JSON.parse(response.data);
    } catch (e) {
      throw new RuntimeError(`Syndication API: invalid JSON: ${response.data.substring(0, 200)}`);
    }

    // Handle tombstone (deleted/suspended tweets)
    if (json.__typename === 'TweetTombstone') {
      throw new RuntimeError(`Tweet is unavailable via syndication (may require login)`);
    }

    this.context = this.standardContextFromSyndication(json);
  }

  /**
   * Standardize context from syndication API response
   * @param {Object} tweet
   * @returns {Object}
   */
  standardContextFromSyndication(tweet) {
    let tweetId = tweet.id_str || (tweet.id ? String(tweet.id) : null);

    if (!tweet || !tweetId) {
      throw new RuntimeError(`Invalid syndication response: ${JSON.stringify(tweet).substring(0, 300)}`);
    }

    let mediaDetails = tweet.mediaDetails || tweet.media || [];
    let createdAt = tweet.created_at || tweet.createdAt || new Date().toISOString();
    let dateFormatter = new DateFormatter(createdAt);
    let images = this.findImages(mediaDetails);
    let videos = this.findVideos(mediaDetails);

    let fullText = tweet.text || tweet.full_text || '';
    let title = fullText.replace(/https?:\/\/t\.co\/\S+/g, '').trim();
    if (title.length > 50) {
      title = title.substring(0, 50);
    }
    if (!title) {
      title = `tweet_${tweetId}`;
    }

    let user = tweet.user || {};

    let sContext = {
      id: tweetId,
      title: title,
      cover: images[0] || null,
      userId: user.id_str || (user.id ? String(user.id) : ''),
      userName: user.screen_name || user.screenName || '',
      displayName: user.name || '',
      year: dateFormatter.getYear(),
      month: dateFormatter.getMonth(),
      day: dateFormatter.getDay(),
      pages: images,
      videos: videos,
      hasVideo: videos.length > 0,
      postType: videos.length > 0 ? 'video' : 'image',
      r: tweet.possibly_sensitive || tweet.possiblySensitive || false,
      __raw: tweet,
    };

    sContext.totalPages = sContext.pages.length;

    return sContext;
  }

  /**
   * Extract tweet media directly from the page DOM as a last resort fallback.
   * Works when tweets are rendered but API data is unavailable.
   */
  fetchFromDOM() {
    let tweetId = this.context.tweetId;
    let username = this.context.username;

    // Find all tweet images on the page
    let imgElements = document.querySelectorAll('img[src*="pbs.twimg.com/media"]');
    let images = [];

    imgElements.forEach(img => {
      let src = img.src;
      // Convert to original quality
      let baseUrl = src.replace(/\?.*$/, '');
      let formatMatch = src.match(/format=(\w+)/);
      let format = formatMatch ? formatMatch[1] : 'jpg';
      let origUrl = baseUrl + '?format=' + format + '&name=orig';

      // Avoid duplicates
      if (!images.includes(origUrl)) {
        images.push(origUrl);
      }
    });

    // Also check for video elements
    let videoElements = document.querySelectorAll('video[src*="video.twimg.com"], video source[src*="video.twimg.com"]');
    let videos = [];

    videoElements.forEach(el => {
      let src = el.src || el.getAttribute('src');
      if (src && !videos.some(v => v.url === src)) {
        videos.push({ url: src, bitrate: 0 });
      }
    });

    if (images.length === 0 && videos.length === 0) {
      throw new RuntimeError('No media found in DOM');
    }

    let now = new Date();

    this.context = {
      id: tweetId,
      title: `tweet_${tweetId}`,
      cover: images[0] || null,
      userId: '',
      userName: username || '',
      displayName: '',
      year: String(now.getFullYear()),
      month: String(now.getMonth() + 1).padStart(2, '0'),
      day: String(now.getDate()).padStart(2, '0'),
      pages: images,
      videos: videos,
      hasVideo: videos.length > 0,
      postType: videos.length > 0 ? 'video' : 'image',
      totalPages: images.length,
      r: false,
      __raw: {},
    };
  }

  /**
   * Parse tweet context data.
   * Priority: 1) Cached interceptor data (instant), 2) Syndication API, 3) Wait for interceptor briefly
   * @returns {Promise}
   */
  async parseContext() {
    this.parseUrl(this.url);

    // Install interceptor to capture Twitter's own API responses (for current + future navigations)
    PostParser.installFetchInterceptor();

    // 1) Check cache instantly (data from previous SPA navigation)
    if (this.tryFetchFromCache()) {
      console.log('[PixivToolkit] Got tweet data from interceptor cache');
      return;
    }

    // 2) Try syndication API (fast, works for public tweets)
    try {
      await this.fetchViaSyndication();
      console.log('[PixivToolkit] Got tweet data from syndication API');
      return;
    } catch (syndicationError) {
      console.debug('[PixivToolkit] Syndication API failed:', syndicationError.message);
    }

    // 3) Extract media URLs directly from the DOM (instant)
    try {
      this.fetchFromDOM();
      console.log('[PixivToolkit] Got tweet data from DOM');
      return;
    } catch (domError) {
      console.debug('[PixivToolkit] DOM extraction failed:', domError.message);
    }

    // 4) Last resort: wait for interceptor data (for tweets still loading via SPA)
    try {
      await this.waitForInterceptedData(3000);
      console.log('[PixivToolkit] Got tweet data from page interceptor');
      return;
    } catch (interceptError) {
      console.debug('[PixivToolkit] Interceptor timeout:', interceptError.message);
    }

    throw new RuntimeError(`Can't fetch tweet ${this.context.tweetId} context via any method`);
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
