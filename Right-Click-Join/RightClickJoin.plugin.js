/**
 * @name RightClickJoin
 * @author Farcrada
 * @version 1.4.0
 * @description Right click a user to join a voice channel they are in.
 * 
 * @website https://github.com/Farcrada/DiscordPlugins
 * @source https://github.com/Farcrada/DiscordPlugins/blob/master/Right-Click-Join/RightClickJoin.plugin.js
 * @updateUrl https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Right-Click-Join/RightClickJoin.plugin.js
 */


const config = {
	info: {
		name: "Right Click Join",
		id: "RightClickJoin",
		menuID: "right-click-join",
		description: "Right click a user to join a voice channel they are in.",
		version: "1.4.0",
		author: "Farcrada",
		updateUrl: "https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Right-Click-Join/RightClickJoin.plugin.js"
	}
}


class RightClickJoin {

	getName() { return config.info.name; }


	load() {
		if (!global.ZeresPluginLibrary) {
			BdApi.showConfirmationModal("Library Missing", `The library plugin needed for ${this.getName()} is missing. Please click Download Now to install it.`, {
				confirmText: "Download Now",
				cancelText: "Cancel",
				onConfirm: () => {
					require("request").get("https://rauenzi.github.io/BDPluginLibrary/release/0PluginLibrary.plugin.js",
						async (error, response, body) => {
							if (error)
								return require("electron").shell.openExternal("https://raw.githubusercontent.com/rauenzi/BDPluginLibrary/master/release/0PluginLibrary.plugin.js");
							await new Promise(r => require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0PluginLibrary.plugin.js"), body, r));
						});
				}
			});
		}

		//First try the updater
		try {
			global.ZeresPluginLibrary.PluginUpdater.checkForUpdate(config.info.name, config.info.version, config.info.updateUrl);
		}
		catch (err) {
			console.error(this.getName(), "Plugin Updater could not be reached, attempting to enable plugin.", err);
			try {
				BdApi.Plugins.enable("ZeresPluginLibrary");
				if (!BdApi.Plugins.isEnabled("ZeresPluginLibrary"))
					throw new Error("Failed to enable ZeresPluginLibrary.");

				global.ZeresPluginLibrary.PluginUpdater.checkForUpdate(config.info.name, config.info.version, config.info.updateUrl);
			}
			catch (err) {
				console.error(this.getName(), "Failed to enable ZeresPluginLibrary for Plugin Updater.", err);

				BdApi.alert("Could not enable or find ZeresPluginLibrary",
					"Could not start the plugin because ZeresPluginLibrary could not be found or enabled. Please enable and/or download it manually into your plugins folder.");
			}
		}
	}

	start() {
		try {
			//Specific functions we need, nothing like a big module
			this.getVoiceStatesForChannel = BdApi.findModuleByProps("getAllVoiceStates", "getVoiceStatesForChannel").getVoiceStatesForChannel;
			this.getChannels = BdApi.findModuleByProps("getChannels", "getDefaultChannel").getChannels;
			this.selectVoiceChannel = BdApi.findModuleByProps("selectChannel").selectVoiceChannel;
			this.fetchProfile = BdApi.findModuleByProps("fetchProfile").fetchProfile;
			this.useStateFromStores = BdApi.findModuleByProps("useStateFromStores").useStateFromStores;

			this.Dispatcher = BdApi.findModuleByProps("dirtyDispatch");
			this.MutualStore = BdApi.findModuleByProps("isFetching", "getUserProfile");

			//Context controls (mainly just the one item we insert)
			this.MenuStore = BdApi.findModuleByProps("MenuRadioItem", "MenuItem");

			//Thanks Discord
			this.patchCallUserItem();
		}
		catch (err) {
			try {
				console.error("Attempting to stop after start error...", err)
				this.stop();
			}
			catch (err) {
				console.error(this.getName() + ".stop()", err);
			}
		}
	}

	stop() { BdApi.Patcher.unpatchAll(config.info.id); }


	async patchCallUserItem() {
		const CallUserItem = await global.ZeresPluginLibrary.ContextMenu.getDiscordMenu("useCallUserItem");

		BdApi.Patcher.after(config.info.id, CallUserItem, "default", (thisObject, methodArguments, returnValue) => {
			return [
				this.rightClickJoinMagic(methodArguments[0]),
				returnValue
			];
		});
	}


	rightClickJoinMagic(props) {
		//Now we gotta check mutual guilds to see if we match anything
		const mutualGuilds = this.useStateFromStores([this.MutualStore], () => this.MutualStore.getMutualGuilds(props.id) ?? []),
			checkAndAddItem = (_mutualGuilds = []) => {
				//So we need a loop through if there's many
				for (let i = 0; i < _mutualGuilds.length; i++) {
					const matchedChannelId = this.checkVoiceForId(this.getChannels(_mutualGuilds[i].guild.id).VOCAL, props.id);
					if (matchedChannelId)
						//We need to have a way to break early if we find anything,
						//to reduce resource consumption.
						//You can only be connected to one voicechannel anyway
						return BdApi.React.createElement(this.MenuStore.MenuItem, {
							//Discord Is One Of Those
							label: "Join Call",
							id: config.info.menuID,
							action: () => {
								//Joining a voicechannel
								this.selectVoiceChannel(matchedChannelId);
							}
						})
				}
			};

		if (mutualGuilds.length < 1) {
			//Gotta make sure we're not fetching already (or risk spamming the API)
			if (this.MutualStore.isFetching(props.id))
				return null;

			this.Dispatcher.wait(() => {
				//Fetch and then we need to fill "mutualGuilds" again, so we just pass the call
				this.fetchProfile(props.id)
					.then(() => {
						return checkAndAddItem(this.MutualStore.getMutualGuilds(props.id) ?? []);
					})
					.catch(error => {
						if (~error?.message?.indexOf("Already dispatching")) return null;
					});
			});
		}
		else
			return checkAndAddItem(mutualGuilds);
	}

	checkVoiceForId(voiceChannels, userId) {
		//Gotta make sure this man is actually in a voice call
		//Loopy whoop
		for (let i = 0; i < voiceChannels.length; i++) {
			//Get all the participants in this voicechannel
			const channelId = voiceChannels[i].channel.id,
				participants = this.getVoiceStatesForChannel(channelId);
			//Loopy doop
			for (const id in participants)
				//If a matching participant is found, engage
				if (participants[id].userId === userId)
					return channelId;
		}
		//If nothing, return null.
		return null;
	}
}
