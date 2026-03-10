import GlobalSettings from "@/modules/GlobalSettings";
import browser from "@/modules/Extension/browser";
import Downloader from "@/modules/Net/Downloader";
import MimeType from "@/modules/Util/MimeType";
import AbstractGenerator from "@/content_scripts/modules/Legacy/UgoiraGenerator/AbstractGenerator";
import AbstractEagleImportTask from "./AbstractEagleImportTask";

class UgoiraImportTask extends AbstractEagleImportTask {
  type = 'EAGLE_PIXIV_UGOIRA';

  options;

  downloader;

  data;

  processProgress = 0;

  ffmpeg;

  generator;

  zip;

  constructor(options) {
    super(options);

    this.options = options;
    this.downloader = new Downloader({
      processors: GlobalSettings().downloadTasksWhenDownloadingImages
    });
    this.downloader.appendFile(options.resource);
    this.downloader.addListener('start', this.onStart, this);
    this.downloader.addListener('progress', this.onProgress, this);
    this.downloader.addListener('item-finish', this.onItemFinish, this);
    this.downloader.addListener('finish', this.onFinish, this);
    this.downloader.addListener('item-error', this.onItemError, this);
    this.downloader.addListener('pause', this.onPause, this);
  }

  static create(options) {
    return new UgoiraImportTask(options);
  }

  buildItemName() {
    return this.getNameFormatter().format(this.options.renameRule, `${this.context.id}`);
  }

  makeAnimationJsonContent(type) {
    if (type === 1) {
      return JSON.stringify(this.context.illustFrames);
    } else if (type === 2) {
      return JSON.stringify({
        ugokuIllustData: {
          src: this.context.illustSrc,
          originalSrc: this.context.illustOriginalSrc,
          mime_type: this.context.illustMimeType,
          frames: this.context.illustFrames
        }
      });
    }
  }

  onStart() {
    //
  }

  onProgress({ progress }) {
    this.progress = progress;
    this.dispatch('progress', [progress]);
  }

  async onItemFinish({ blob }) {
    this.data = blob;
    this.zip = new JSZip();
    await this.zip.loadAsync(blob);

    if (this.options.packAnimationJsonType > 0) {
      this.zip.file('animation.json', this.makeAnimationJsonContent(this.options.packAnimationJsonType));
    }

    this.dispatch('progress', [this.progress]);
  }

  async runFFmpeg(completeHandler) {
    let { createFFmpeg } = FFmpeg;
    this.ffmpeg = new createFFmpeg({
      log: true,
      corePath: browser.runtime.getURL('lib/ffmpeg/ffmpeg-core.js'),
    });
    this.ffmpeg.setProgress(progress => {
      this.processProgress = progress.ratio;
      this.dispatch('progress', [progress.ratio]);
    });

    await this.ffmpeg.load();

    let framesContent = '';
    let loadedFiles = [];

    for (let i = 0; i < this.options.frames.length; i++) {
      let frame = this.options.frames[i];
      let data = await this.zip.file(frame.file).async('uint8array');
      let indexStr = i + '';
      let filename = '0'.repeat(6 - indexStr.length) + i + '.jpg';
      this.ffmpeg.FS('writeFile', filename, data);
      loadedFiles.push(filename);

      framesContent += `file '${frame.file}'\r\n`;
      framesContent += `duration ${frame.delay / 1000}\r\n`;
    }

    this.ffmpeg.FS('writeFile', 'input.txt', framesContent);
    loadedFiles.push('input.txt');

    const ffmpegCommands = [];
    const ffmpegCommandSetting = this.options.ffmpegCommandArgs ? this.options.ffmpegCommandArgs.trim() : null;

    if (!ffmpegCommandSetting) {
      ffmpegCommands.push(['-f', 'concat', '-i', 'input.txt', '-plays', 0, 'out.gif']);
    } else {
      ffmpegCommandSetting.split(/\r\n|\n|\r/).forEach(line => {
        ffmpegCommands.push(line.trim().split(' '));
      });
    }

    const lastCommand = ffmpegCommands[ffmpegCommands.length - 1];
    const outputFilename = lastCommand[lastCommand.length - 1];

    for (const command of ffmpegCommands) {
      await this.ffmpeg.run.apply(this.ffmpeg, command);
    }

    await completeHandler.call(this, {
      data: this.ffmpeg.FS('readFile', outputFilename),
      outputFilename
    });

    loadedFiles.push(outputFilename);
    loadedFiles.forEach(file => this.ffmpeg.FS('unlink', file));

    this.ffmpeg.exit();
    this.ffmpeg = null;
  }

  async importGeneratedBlob(blob, mimeType) {
    const folderId = await this.resolveTargetFolderId(this.getWorkFolderName());

    await this.importBlob({
      blob,
      name: this.buildItemName(),
      folderId
    });

    this.progress = 1;
    this.changeState(this.COMPLETE_STATE);
    await this.markHistoryImported();
    this.dispatch('complete');
  }

  async onFinish() {
    this.changeState(this.PROCESSING_STATE);

    if (this.generator instanceof AbstractGenerator) {
      this.generator.addListener('progress', progress => {
        this.processProgress = progress;
        this.dispatch('progress', [progress]);
      });

      this.generator.addListener('complete', async (blob, mimeType) => {
        await this.importGeneratedBlob(blob, mimeType);
      });

      this.generator.addListener('error', error => {
        this.changeState(this.FAILURE_STATE);
        this.dispatch('error', [error]);
      });

      this.generator.generate(this);
      return;
    }

    await this.runFFmpeg(async ({ data, outputFilename }) => {
      const mimeType = MimeType.getFileMimeType(outputFilename);
      await this.importGeneratedBlob(new Blob([data], { type: mimeType }), mimeType);
    });
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

  abortProcess() {
    if (this.downloader) {
      this.downloader.pause();
    }

    if (this.ffmpeg) {
      this.ffmpeg.exit();
      this.ffmpeg = null;
      this.processProgress = 0;
    }

    if (this.generator) {
      this.generator.stop();
    }
  }

  pause() {
    if (this.state !== this.PROCESSING_STATE) {
      this.changeState(this.PAUSED_STATE);
      this.abortProcess();
    }
  }

  stop() {
    this.abortProcess();
  }

  toJson() {
    return Object.assign({}, super.toJson(), {
      processProgress: this.processProgress,
      convertType: this.options.convertType
    });
  }
}

export default UgoiraImportTask;
