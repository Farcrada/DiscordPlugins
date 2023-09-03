/**
 * @name Right Click Join
 * @author Farcrada
 * @version 1.6.1
 * @description Right click a user to join a voice channel they are in.
 * 
 * @invite qH6UWCwfTu
 * @website https://github.com/Farcrada/DiscordPlugins
 * @source https://github.com/Farcrada/DiscordPlugins/blob/master/Right-Click-Join/RightClickJoin.plugin.js
 * @updateUrl https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Right-Click-Join/RightClickJoin.plugin.js
 */

const { Webpack, Webpack: { Filters }, Patcher, ContextMenu } = BdApi,
	config = {};


module.exports = class RightClickJoin {


	constructor(meta) { config.info = meta; }

	load() {
		try { global.ZeresPluginLibrary.PluginUpdater.checkForUpdate(config.info.name, config.info.version, config.info.updateUrl); }
		catch (err) { console.error(config.info.name, "Failed to reach the ZeresPluginLibrary for Plugin Updater.", err); }
	}

	start() {
		try {
			this.VoiceStateStore = Webpack.getStore("VoiceStateStore");
			this.GuildChannelStore = Webpack.getStore("GuildChannelStore");
			this.selectVoiceChannel = Webpack.getModule(Filters.byKeys("selectChannel")).selectVoiceChannel;
			this.UserProfileStore = Webpack.getStore("UserProfileStore");

			this.patchUserContextMenu();
		}
		catch (err) {
			try {
				console.error("Attempting to stop after start error...", err)
				this.stop();
			}
			catch (err) {
				console.error(config.info.name + ".stop()", err);
			}
		}
	}

	stop() { Patcher.unpatchAll(config.info.slug); }


	patchUserContextMenu() {
		const { module, key } = this.getModuleAndKey(Filters.byStrings("MenuItem,{id:\"call\","), {searchExports: false});

		Patcher.after(config.info.slug, module, key, (thisObject, methodArguments, returnValue) => {
			return [
				this.rightClickJoinMagic(methodArguments[0]),
				returnValue
			];
		});
	}


	rightClickJoinMagic(props) {
		const mutualGuilds = this.UserProfileStore.getMutualGuilds(props.id),
			checkVoiceForId = (voiceChannels, userId) => {
				//Gotta make sure this man is actually in a voice call
				for (let i = 0; i < voiceChannels.length; i++) {
					const channelId = voiceChannels[i].channel.id,
						//Get all the participants in this voicechannel
						participants = this.VoiceStateStore.getVoiceStatesForChannel(channelId);

					for (const id in participants)
						//If a matching participant is found
						if (participants[id].userId === userId)
							return channelId;
				}
				return null;
			};

		if (mutualGuilds?.length > 0)
			for (let i = 0; i < mutualGuilds.length; i++) {
				const matchedChannelId = checkVoiceForId(this.GuildChannelStore.getChannels(mutualGuilds[i].guild.id).VOCAL, props.id);

				if (matchedChannelId)
					return ContextMenu.buildItem({
						label: "Join Call",
						id: config.info.menuID,
						action: () => {
							this.selectVoiceChannel(matchedChannelId);
						}
					});
			};

		return null;
	}

	/**
	 * @param {function} filter Filter to search all the exports with
	 * @param {object} options Options to use while searching.
	 * @returns {object} Module with the key
	 */
	getModuleAndKey(filter, options) {
		let module;
		const target = Webpack.getModule((entry, m) => filter(entry) ? (module = m) : false, options);

		module = module?.exports;

		if (!module)
			return undefined;

		const key = Object.keys(module).find(k => module[k] === target);

		if (!key)
			return undefined;
		return { module, key };
	}
};
