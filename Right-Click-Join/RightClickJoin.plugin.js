/**
 * @name RightClickJoin
 * @author Farcrada
 * @version 1.3.0
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
		description: "Right click a user to join a voice channel they are in.",
		version: "1.3.0",
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
			this.indexObject = {
				DM: { section: 2, child: 1 },
				GUILD: { section: 1, child: 3 }
			}

			//Specific functions we need, nothing like a big module
			this.getVoiceStatesForChannel = BdApi.findModuleByProps("getAllVoiceStates", "getVoiceStatesForChannel").getVoiceStatesForChannel;
			this.getChannels = BdApi.findModuleByProps("getChannels", "getDefaultChannel").getChannels;
			this.selectVoiceChannel = BdApi.findModuleByProps("selectChannel").selectVoiceChannel;
			this.fetchProfile = BdApi.findModuleByProps("fetchProfile").fetchProfile;

			this.ChannelStore = BdApi.findModuleByProps("getChannel", "getDMFromUserId");
			this.MutualStore = BdApi.findModuleByProps("isFetching", "getUserProfile");

			//Context controls (mainly just the one item we insert)
			this.MenuItem = BdApi.findModuleByProps("MenuRadioItem", "MenuItem").MenuItem;


			//New way to patch context menu's
			this.patchLazyOpener();

			//Patch the guild context menu
			this.patchGuildChannelUserContextMenu();
			//And since it would be handy to join from a DM, it's approached differently.
			this.patchDMUserContextMenu();
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


	//Patch in our context item when in a guild
	async patchGuildChannelUserContextMenu() {
		const GuildUserContextMenu = await this.getDiscordMenu(m => m.displayName === "GuildChannelUserContextMenu");

		BdApi.Patcher.after(config.info.id, GuildUserContextMenu, "default", (thisObject, methodArguments, returnValue) => {
			this.rightClickJoinMagic(methodArguments[0], this.indexObject.GUILD, returnValue, true);
		});
	}

	//Patch in our context item when in the DMs
	async patchDMUserContextMenu() {
		const DMUserContextMenu = await this.getDiscordMenu(m => m.displayName === "DMUserContextMenu");

		BdApi.Patcher.after(config.info.id, DMUserContextMenu, "default", (thisObject, methodArguments, returnValue) => {
			this.rightClickJoinMagic(methodArguments[0], this.indexObject.DM, returnValue);
		});
	}

	getDiscordMenu(filter) {
		const directMatch = BdApi.findModule(m => m.default && filter(m.default));

		if (directMatch)
			return Promise.resolve(directMatch);

		return new Promise(resolve => {
			const listener = () => {
				const match = BdApi.findModule(m => m.default && filter(m.default));
				if (!match) return;

				this.contextMenuListeners.delete(listener);
				return resolve(match);
			};

			this.contextMenuListeners.add(listener);
		});
	}

	patchLazyOpener() {
		this.contextMenuListeners = new Set();

		const ContextMenuActions = BdApi.findModuleByProps("openContextMenu");

		BdApi.Patcher.before(config.info.id, ContextMenuActions, "openContextMenuLazy", (_, methodArguments) => {
			const originalRender = methodArguments[1];

			if (typeof (originalRender) !== "function")
				return;

			methodArguments[1] = (...args) => {
				const menuPromise = Reflect.apply(originalRender, null, args);

				return menuPromise.then(render => {
					const listeners = [...this.contextMenuListeners];

					for (let i = 0; i < listeners.length; i++) {
						const listener = listeners[i];
						try { listener(); }
						catch (e) {
							console.error("Lazy Context Pacth", "Failed to patch:", e);
						}
					}

					return render;
				});
			}
		});
	}


	rightClickJoinMagic(props, indexObject, returnValue, guild = false) {
		if (guild) {
			//Get the channel object.
			const channel = this.ChannelStore.getChannel(props.channelId);
			if (channel.isVocal()) {
				//If we right click a channel in that guild, we can mitigate our intense searching.
				this.constructMenuItem(returnValue, indexObject, channel.id);
				//And return here to prevent duplicates
				return;
			}
		}

		//Now we gotta check mutual guilds to see if we match anything
		const userId = props.user.id,
			mutualGuilds = this.MutualStore.getMutualGuilds(userId) ?? [],
			checkAndAddItem = (_mutualGuilds = []) => {
				//So we need a loop through if there's many
				for (let i = 0; i < _mutualGuilds.length; i++) {
					const matchedChannelId = this.checkVoiceForId(this.getChannels(_mutualGuilds[i].guild.id).VOCAL, userId);
					if (matchedChannelId) {
						this.constructMenuItem(returnValue, indexObject, matchedChannelId);
						//We need to have a way to break early if we find anything,
						//to reduce resource consumption.
						//You can only be connected to one voicechannel anyway

						break;
					}
				}
			};

		if (mutualGuilds.length < 1) {
			//Gotta make sure we're not fetching already (or risk spamming the API)
			if (this.MutualStore.isFetching(userId))
				return;

			//Fetch and then we need to fill "mutualGuilds" again, so we just pass the call
			this.fetchProfile(userId).then(() => { checkAndAddItem(this.MutualStore.getMutualGuilds(userId)); });
		}
		else
			checkAndAddItem(mutualGuilds);
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
		//Return false so our DM patch knows what to do.
		return false;
	}

	constructMenuItem(returnValue, indexObject, channelId) {
		//Splice and insert our context item
		//                the menu,    the sections,               the items of this section
		returnValue?.props?.children?.props?.children[indexObject.section]?.props?.children?.splice(
			//We want it after the "call" option.
			indexObject.child,
			0,
			BdApi.React.createElement(this.MenuItem, {
				//Discord Is One Of Those
				label: "Join Call",
				id: config.info.name.toLowerCase().replace(' ', '-'),
				action: () => {
					//Joining a voicechannel
					this.selectVoiceChannel(channelId);
				}
			})
		);
	}
}
