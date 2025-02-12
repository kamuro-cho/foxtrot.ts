import {
  CommandClient,
  Constants as DetritusConstants,
  Utils,
} from 'detritus-client';

import { Constants, listEffects } from '@/modules/utils';
import { BaseVoiceCommand, VoiceContext } from '../base';

export default class EffectRemoveCommand extends BaseVoiceCommand {
  constructor(commandClient: CommandClient) {
    super(commandClient, {
      name: 'e remove',
      aliases: ['effect remove', 'e rm', 'effect rm'],
      type: [
        {
          name: 'effect',
          type: DetritusConstants.CommandArgumentTypes.NUMBER,
          required: true,
        },
      ],
    });
  }

  public async run(ctx: VoiceContext, { effect }: { effect: number }) {
    if (!ctx.guild) return;
    ctx.voice.effects.removeEffect(effect);
    const embed = await listEffects(
      ctx.guild,
      ctx.voice.effects.list,
      ctx.voice.effects.STACK_LIMIT
    );
    embed.setTitle(
      Constants.EMOJIS.MINUS +
        ' ' +
        (await this.t(ctx, 'commands.effect.remove', effect))
    );
    ctx.reply({ embed });
  }
}
