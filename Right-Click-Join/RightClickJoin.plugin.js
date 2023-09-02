/**
 * @name Right Click Join
 * @author Farcrada
 * @version 1.6.0
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
			//Specific functions we need, nothing like a big module
			this.VoiceStateStore = Webpack.getStore("VoiceStateStore");
			this.GuildChannelStore = Webpack.getStore("GuildChannelStore");
			this.selectVoiceChannel = Webpack.getModule(Filters.byKeys("selectChannel")).selectVoiceChannel;
			this.UserProfileStore = Webpack.getStore("UserProfileStore");
			this.useStateFromStores = Webpack.getModule(Filters.byStrings("useStateFromStores"), { searchExports: true });
			this.ContextMenuStore = Webpack.getStore("ContextMenuStore");

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

	stop() { Patcher.unpatchAll(config.info.slug); config.userContextPatch; }


	patchUserContextMenu() {
		config.userContextPatch = ContextMenu.patch("user-context", (returnValue, props) => {
			const location = returnValue?.props?.children[0]?.props?.children[1]?.props?.children;
			if (!location?.some?.(item => item && item?.props?.id === config.info.menuID))
				location.splice(location.findIndex(item => item && item?.props?.id === "call"), 0, this.rightClickJoinMagic(props));
		});
	}


	rightClickJoinMagic(props) {
		if (this.UserProfileStore.isFetchingProfile(props.user.id))
			return null;
		
		const mutualGuilds = this.UserProfileStore.getMutualGuilds(props.user.id),
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
				const matchedChannelId = checkVoiceForId(this.GuildChannelStore.getChannels(mutualGuilds[i].guild.id).VOCAL, props.user.id);

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
}
