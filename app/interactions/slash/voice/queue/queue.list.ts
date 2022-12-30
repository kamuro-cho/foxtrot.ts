import { Utils } from 'detritus-client';

import { PaginatorsStore } from '@/modules/stores';
import { Constants, durationInString, Paginator } from '@/modules/utils';
import { VoiceFormatResponseInfo } from '@/modules/voice/managers';

import { BaseVoiceCommandOption, VoiceInteractionContext } from '../base';

export class QueueListCommand extends BaseVoiceCommandOption {
  public name = 'list';
  public description = 'List queue.';

  public async run(ctx: VoiceInteractionContext) {
    if (!ctx.guild) return;

    const { info } = ctx.voice.queue;
    if (info.length === 0) return ctx.editOrRespond('Nothing is in the queue');

    const pages = [];
    while (info.length)
      pages.push(info.splice(0, Constants.QUEUE_PAGE_ITEMS_MAXIMUM));

    const paginator = PaginatorsStore.create(ctx, {
      pages,
      onEmbed(
        this: Paginator,
        page: VoiceFormatResponseInfo[],
        embed: Utils.Embed
      ) {
        embed.setTitle('Queue - ' + embed.title);
        const description = page
          .map((info, k) => {
            const position =
              this.currentPage * Constants.QUEUE_PAGE_ITEMS_MAXIMUM + k + 1;
            const duration = Utils.Markup.codestring(
              durationInString(info.duration)
            );
            const suffix = info.submittee ? ` - ${info.submittee.mention}` : '';
            return `${position}) ${duration} ${info.title}` + suffix;
          })
          .join('\n');
        embed.setDescription(description);
      },
    });
    await paginator.start();
  }
}
