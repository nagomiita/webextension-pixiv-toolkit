import GlobalSettings from "@/modules/GlobalSettings";
import { RuntimeError } from "@/errors";
import {
  FanboxPostResource,
  PixivComicEpisdoeResource,
  PixivIllustResource,
  PixivNovelResource,
  TwitterPostResource,
} from '@/modules/PageResource/index';
import MultiplePageImportTask from "./EagleImportTasks/MultiplePageImportTask";
import UgoiraImportTask from "./EagleImportTasks/UgoiraImportTask";

class EagleImportAdapter {
  settings;

  constructor() {
    this.settings = GlobalSettings();
  }

  static create() {
    return new EagleImportAdapter();
  }

  getCommonOptions(resource, context) {
    const createWorkFolder = typeof this._createWorkFolderOverride === 'boolean'
      ? this._createWorkFolderOverride
      : !!this.settings.eagleCreateWorkFolder;

    return {
      apiUrl: this.settings.eagleApiUrl,
      eagleBaseFolderId: this.settings.eagleBaseFolderId,
      eagleCreateWorkFolder: createWorkFolder,
      historyUid: resource.getUid(),
      url: context.targetUrl || resource.getUrl(),
      context,
    };
  }

  createIllustImportTask(resource, options, context) {
    if (!Array.isArray(context.pages) || context.pages.length < 1) {
      const error = new RuntimeError('There is no image to import.');
      error.name = 'EagleNoImportItemError';
      throw error;
    }

    return MultiplePageImportTask.create(Object.assign(this.getCommonOptions(resource, context), {
      id: `eagle:${resource.getUid()}`,
      type: resource.isManga() ? 'EAGLE_PIXIV_MANGA' : 'EAGLE_PIXIV_ILLUST',
      resourceType: resource.isManga() ? 'pixiv_manga' : 'pixiv_illust',
      pages: context.pages,
      selectedIndexes: options.selectedIndexes,
      renameRule: resource.isManga() ? this.settings.mangaRenameRule : this.settings.illustRenameRule,
      renameImageRule: resource.isManga() ? this.settings.mangaRenameImageRule : this.settings.illustRenameImageRule,
      pageNumberStartWithOne: resource.isManga() ?
        (this.settings.mangaPageNumberStartWithOne === -2 ? this.settings.globalTaskPageNumberStartWithOne : this.settings.mangaPageNumberStartWithOne) :
        (this.settings.illustrationPageNumberStartWithOne === -2 ? this.settings.globalTaskPageNumberStartWithOne : this.settings.illustrationPageNumberStartWithOne),
      pageNumberLength: resource.isManga() ?
        (this.settings.mangaPageNumberLength === -2 ? this.settings.globalTaskPageNumberLength : this.settings.mangaPageNumberLength) :
        (this.settings.illustrationPageNumberLength === -2 ? this.settings.globalTaskPageNumberLength : this.settings.illustrationPageNumberLength),
    }));
  }

  createUgoiraImportTask(resource, options, context) {
    const fixedFFmpegCliArgs = {
      ugoiraFFmpegGIFCliArgs: '-f concat -i input.txt -plays 0 out.gif',
      ugoiraFFmpegAPNGCliArgs: '-f concat -i input.txt -plays 0 output.apng',
      ugoiraFFmpegWEBMCliArgs: '-f concat -i input.txt -safe 0 output.webm',
      ugoiraFFmpegMP4CliArgs: '-f concat -i input.txt -safe 0 -c copy output.mp4'
    };

    let ffmpegCommandArgs = this.settings.ugoiraCustomFFmpegCommand;
    let convertType = 'CUSTOM';

    if (options && typeof options.ugoiraConvertType === 'string') {
      const key = `ugoiraFFmpeg${options.ugoiraConvertType.toUpperCase()}CliArgs`;

      if (fixedFFmpegCliArgs[key]) {
        ffmpegCommandArgs = fixedFFmpegCliArgs[key];
        convertType = options.ugoiraConvertType;
      }
    }

    return UgoiraImportTask.create(Object.assign(this.getCommonOptions(resource, context), {
      id: `eagle:${resource.getDownloadTaskId(convertType)}`,
      type: 'EAGLE_PIXIV_UGOIRA',
      resourceType: 'pixiv_ugoira',
      uid: resource.getUid(),
      resource: context.illustOriginalSrc,
      frames: context.illustFrames,
      packAnimationJsonType: this.settings.animationJsonFormat,
      renameRule: this.settings.ugoiraRenameRule,
      ffmpegCommandArgs,
      convertType
    }));
  }

  createComicImportTask(resource, options, context) {
    if (!Array.isArray(context.pages) || context.pages.length < 1) {
      const error = new RuntimeError('There is no image to import.');
      error.name = 'EagleNoImportItemError';
      throw error;
    }

    return MultiplePageImportTask.create(Object.assign(this.getCommonOptions(resource, context), {
      id: `eagle:${resource.getUid()}`,
      type: 'EAGLE_PIXIV_COMIC_EPISODE',
      resourceType: 'pixiv_comic_episode',
      pages: context.pages,
      selectedIndexes: options.selectedIndexes,
      renameRule: this.settings.pixivComicEpisodeRenameRule,
      renameImageRule: this.settings.pixivComicEpisodeRenameImageRule,
      pageNumberStartWithOne: this.settings.pixivComicEpisodePageNumberStartWithOne === -2 ?
        this.settings.globalTaskPageNumberStartWithOne :
        this.settings.pixivComicEpisodePageNumberStartWithOne,
      pageNumberLength: this.settings.pixivComicEpisodePageNumberLength === -2 ?
        this.settings.globalTaskPageNumberLength :
        this.settings.pixivComicEpisodePageNumberLength,
    }));
  }

  createTwitterImportTask(resource, options, context) {
    // Use video URLs as pages if no images but videos exist
    let pages = context.pages;
    if ((!Array.isArray(pages) || pages.length < 1) && context.videos && context.videos.length > 0) {
      pages = context.videos.map(v => v.url);
    }

    if (!Array.isArray(pages) || pages.length < 1) {
      const error = new RuntimeError('There is no media to import.');
      error.name = 'EagleNoImportItemError';
      throw error;
    }

    return MultiplePageImportTask.create(Object.assign(this.getCommonOptions(resource, context), {
      id: `eagle:${resource.getUid()}`,
      type: 'EAGLE_TWITTER_POST',
      resourceType: 'twitter_post',
      pages: pages,
      selectedIndexes: options.selectedIndexes,
      renameRule: this.settings.twitterPostRenameRule,
      renameImageRule: this.settings.twitterPostRenameImageRule,
      pageNumberStartWithOne: this.settings.twitterPostPageNumberStartWithOne === -2 ?
        this.settings.globalTaskPageNumberStartWithOne :
        this.settings.twitterPostPageNumberStartWithOne,
      pageNumberLength: this.settings.twitterPostPageNumberLength === -2 ?
        this.settings.globalTaskPageNumberLength :
        this.settings.twitterPostPageNumberLength,
    }));
  }

  createFanboxImportTask(resource, options, context) {
    if (!Array.isArray(context.pages) || context.pages.length < 1) {
      const error = new RuntimeError('There is no image to import.');
      error.name = 'EagleNoImportItemError';
      throw error;
    }

    return MultiplePageImportTask.create(Object.assign(this.getCommonOptions(resource, context), {
      id: `eagle:${resource.getUid()}`,
      type: 'EAGLE_FANBOX_POST',
      resourceType: 'fanbox_post',
      pages: context.pages,
      selectedIndexes: options.selectedIndexes,
      renameRule: this.settings.fanboxPostRenameRule,
      renameImageRule: this.settings.fanboxPostRenameImageRule,
      pageNumberStartWithOne: this.settings.fanboxPostPageNumberStartWithOne === -2 ?
        this.settings.globalTaskPageNumberStartWithOne :
        this.settings.fanboxPostPageNumberStartWithOne,
      pageNumberLength: this.settings.fanboxPostPageNumberLength === -2 ?
        this.settings.globalTaskPageNumberLength :
        this.settings.fanboxPostPageNumberLength,
    }));
  }

  async createImportTask(resource, options = {}) {
    // Per-import createWorkFolder overrides global setting
    if (typeof options.createWorkFolder === 'boolean') {
      this._createWorkFolderOverride = options.createWorkFolder;
    }

    const context = resource.getContext();
    context.targetUrl = context.targetUrl || resource.getUrl();

    if (resource instanceof PixivIllustResource) {
      if (resource.isUgoira()) {
        return this.createUgoiraImportTask(resource, options, context);
      }

      return this.createIllustImportTask(resource, options, context);
    }

    if (resource instanceof PixivComicEpisdoeResource) {
      return this.createComicImportTask(resource, options, context);
    }

    if (resource instanceof FanboxPostResource) {
      return this.createFanboxImportTask(resource, options, context);
    }

    if (resource instanceof TwitterPostResource) {
      return this.createTwitterImportTask(resource, options, context);
    }

    if (resource instanceof PixivNovelResource) {
      const error = new RuntimeError('Pixiv novel import is not supported in Eagle.');
      error.name = 'EagleUnsupportedResourceError';
      throw error;
    }

    const error = new RuntimeError(`Cannot create Eagle import task with resource [${resource.constructor.name}].`);
    error.name = 'EagleUnsupportedResourceError';
    throw error;
  }
}

export default EagleImportAdapter;
