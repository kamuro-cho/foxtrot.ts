import { Structures, Utils } from 'detritus-client';
import { EventEmitter } from 'events';

import mediaservice from '@/modules/managers/mediaservices';
import {
  DownloadReturnedValue,
  MediaServiceResponse,
  MediaServiceResponseInformation,
  MediaServiceResponseMediaType,
} from '@/modules/managers/mediaservices/types';
import { sendFeedback, UserError } from '@/modules/utils';

import VoiceQueueAnnouncer from './announcer';
import NewVoice from '.';

const FORMAT_FROMURL_TIMEOUT = 30; // in seconds

// exists solely so there will not be a racing condition
class VoiceQueueMedia extends EventEmitter {
  private _children?: VoiceQueueMedia[];
  private formatData!: DownloadReturnedValue;
  private _submittee?: Structures.User;
  private message?: Structures.Message;
  private url: string;

  constructor(
    url: string | MediaServiceResponse,
    message?: Structures.Message | Structures.User
  ) {
    super();

    if (message instanceof Structures.User) this._submittee = message;
    else this.message = message;

    if (typeof url === 'string') {
      this.url = url;
      this.fetchFormatData();
    } else {
      this.url = url.information.url;
      this.formatData = url;
    }
  }

  private get submittee(): Structures.User | undefined {
    if (this._submittee) return this._submittee;
    return this.message ? this.message.author : undefined;
  }

  public get info(): MediaServiceResponseInformation {
    if (this.formatData && !Array.isArray(this.formatData))
      return this.formatData.information;

    return {
      title: '[loading...]',
      author: '',
      duration: 0,
      url: this.url,
    };
  }

  public get loaded() {
    return this.formatData !== undefined;
  }

  public get children() {
    if (!this.formatData)
      throw new Error(
        'children getter called on an invalid VoiceQueueMedia object'
      );

    if (!Array.isArray(this.formatData)) return [this];

    if (this._children) return this._children;

    return (this._children = this.formatData.map(x => new VoiceQueueMedia(x)));
  }

  private async fetchFormatData() {
    try {
      let result;

      let timeoutHandle;
      const timeoutPromise = new Promise<void>((_, rej) => {
        timeoutHandle = setTimeout(
          () =>
            rej(
              new Error(
                'download timed out (' + FORMAT_FROMURL_TIMEOUT + ' seconds)'
              )
            ),
          FORMAT_FROMURL_TIMEOUT * 1000
        );
      });

      result = await Promise.race([
        timeoutPromise,
        mediaservice.download(this.url),
      ]);
      clearTimeout(timeoutHandle);

      if (!result) throw new UserError('queue.url-unsupported');

      if (this.submittee) {
        if (Array.isArray(result)) {
          for (let i = 0; i < result.length; i++)
            result[i].information.metadata = {
              name: this.submittee.tag,
              icon_url: this.submittee.avatarUrl,
              url: this.message ? this.message.jumpLink : undefined,
            };
        } else
          result.information.metadata = {
            name: this.submittee.tag,
            icon_url: this.submittee.avatarUrl,
            url: this.message ? this.message.jumpLink : undefined,
          };
      }

      this.formatData = result;
    } catch (err) {
      return this.emit('error', err);
    }

    this.emit('finish');
  }

  public async getStream() {
    if (!this.formatData || Array.isArray(this.formatData))
      throw new Error('getStream called on an invalid VoiceQueueMedia object');

    switch (this.formatData.media.type) {
      case MediaServiceResponseMediaType.URL:
        return this.formatData.media.url;
      case MediaServiceResponseMediaType.FETCH:
        return await this.formatData.media.fetch();
      default:
        throw new Error('unknown VoiceFormatResponseType');
    }
  }
}

export default class VoiceQueue {
  public readonly announcer: VoiceQueueAnnouncer;
  private queue: VoiceQueueMedia[] = [];
  private readonly voice: NewVoice;

  constructor(voice: NewVoice, logChannel: Structures.ChannelTextType) {
    this.voice = voice;
    this.announcer = new VoiceQueueAnnouncer(voice, logChannel);
  }

  public async push(
    url: string,
    message?: Structures.Message | Structures.User
  ) {
    const object = new VoiceQueueMedia(url, message);
    this.queue.push(object);

    return new Promise((res, rej) => {
      object.once('finish', () => {
        const index = this.queue.indexOf(object);
        if (index === -1) return;
        this.queue.splice(index, 1, ...object.children);

        if (!this.voice.isPlaying) this.next();

        res(true);
      });

      object.once('error', error => {
        rej(error);

        const index = this.queue.indexOf(object);
        if (index !== -1) this.queue.splice(index, 1);
      });
    });
  }

  public get info() {
    return this.queue.map(response => response.info);
  }

  public delete(id: number) {
    if (!this.queue[id]) throw new UserError('queue.not-found');
    return this.queue.splice(id, 1)[0];
  }

  public clear() {
    this.queue = [];
  }

  public streamingError(err: any) {
    const error = Utils.Markup.codestring(err.toString());
    this.announcer.createMessage('Skipping due to a streaming error: ' + error);
    this.next();

    sendFeedback(
      this.announcer.channel.client.rest,
      'Stream threw an error! ' + error
    );
    console.error(err);
  }

  private async continue(media: VoiceQueueMedia) {
    this.announcer.play(media.info);
    try {
      this.voice.play(await media.getStream());
    } catch (err: any) {
      this.streamingError(err);
    }
  }

  public async next() {
    if (this.voice.isPlaying) return;
    this.announcer.reset();

    if (this.queue.length === 0) return;

    const media = this.queue[0];
    if (!media) return;
    if (!media.loaded) {
      this.announcer.createLoadingMessage();
      return;
    }

    this.queue.shift();
    this.continue(media);

    // this.voice.playStream(singleResponse.readable ? singleResponse.readable : await singleResponse.fetch());
  }
}
