import { RichEmbed } from 'discord.js';
import * as moment from 'moment';
import { Client, Command, Logger, logger, Message } from 'yamdbf';

import { inviteCodes, members } from '../sequelize';
import { createEmbed } from '../utils/util';

export default class extends Command<Client> {
	@logger('Command')
	private readonly _logger: Logger;

	public constructor() {
		super({
			name: 'invite-codes',
			aliases: ['invite-code', 'get-invite-codes', 'getInviteCode', 'invite-codes',
				'inviteCodes', 'InviteCode', 'getInviteCode', 'get-invite-code', 'showInviteCode', 'show-invite-code'],
			desc: 'Get a list of all your active invite codes',
			usage: '<prefix>invite-codes',
			clientPermissions: ['MANAGE_GUILD'],
			guildOnly: true
		});
	}

	public async action(message: Message, args: string[]): Promise<any> {
		this._logger.log(`${message.guild.name} (${message.author.username}): ${message.content}`);

		const codes = await inviteCodes.findAll({
			where: {
				guildId: message.guild.id,
			},
			include: [{
				model: members,
				as: 'inviter',
				where: {
					id: message.author.id
				},
				required: true
			}]
		});

		const validCodes = codes.filter(c => moment(c.createdAt).add(c.maxAge, 'second').isAfter(moment()));
		const temporaryInvites = validCodes.filter(i => i.maxAge > 0);
		const permanentInvites = validCodes.filter(i => i.maxAge === 0);
		const recommendedCode = permanentInvites.reduce((max, val) => val.uses > max.uses ? val : max, permanentInvites[0]);

		const embed = new RichEmbed();
		embed.setTitle(`You have the following codes on the server ${message.guild.name}`);

		if (permanentInvites.length === 0 && temporaryInvites.length === 0) {
			embed.setDescription(`You don't have any active invite codes. ` +
				`Please ask the moderators of the server how to create one.`);
		} else {
			if (recommendedCode) {
				embed.addField(`Recommended invite code`, `https://discord.gg/${recommendedCode.code}`);
			} else {
				embed.addField(`Recommended invite code`, `Please create a permanent invite code.`);
			}
		}
		if (permanentInvites.length > 0) {
			embed.addBlankField();
			embed.addField('Permanent', 'These invites don\'t expire.');
			permanentInvites.forEach(i => {
				embed.addField(
					`${i.code} (${i.maxAge > 0 ? 'Temporary' : 'Permanent'})`,
					`**Uses**: ${i.uses}\n**Max Age**:${i.maxAge}\n**Max Uses**: ${i.maxUses}\n**Channel**: <#${i.channelId}>\n`,
					true
				);
			});
		}
		if (temporaryInvites.length > 0) {
			embed.addBlankField();
			embed.addField('Temporary', 'These invites expire after a certain time.');
			temporaryInvites.forEach(i => {
				embed.addField(
					`${i.code} (${i.maxAge > 0 ? 'Temporary' : 'Permanent'})`,
					`**Uses**: ${i.uses}\n**Max Age**:${moment.duration(i.maxAge).humanize()}\n**Max Uses**: ${i.maxUses}\n` +
					`**Channel**: <#${i.channelId}>\n**Expires in**: ${moment(i.createdAt).add(i.maxAge, 's').fromNow()}`,
					true
				);
			});
		}

		createEmbed(message.client, embed);

		message.author.send({ embed });
		message.reply('I sent you a DM with all your invite codes.');
	}
}
