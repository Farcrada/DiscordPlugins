/**
 * @name Right Click Join
 * @author Farcrada
 * @version 1.7.0
 * @description Right click a user to join a voice channel they are in.
 * 
 * @invite qH6UWCwfTu
 * @website https://github.com/Farcrada/DiscordPlugins
 * @source https://github.com/Farcrada/DiscordPlugins/blob/master/Right-Click-Join/RightClickJoin.plugin.js
 * @updateUrl https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Right-Click-Join/RightClickJoin.plugin.js
 */

const { Webpack, Webpack: { Filters }, Patcher, ContextMenu, Utils } = BdApi,
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

			this.Dispatcher = Webpack.getModule(Webpack.Filters.byKeys("_dispatch"));

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

	stop() { Patcher.unpatchAll(config.info.slug); config.userContextPatch(); }


	patchUserContextMenu() {

		config.userContextPatch = ContextMenu.patch("user-context", (returnValue, props) => {
			// How does the button object look like?
			const callButtonFilter = button => button?.props?.id === "call";
			// Now that we know how the button looks like, we can make a filter to find the parent.
			let callButtonParent = Utils.findInTree(returnValue, e => Array.isArray(e) && e.some(callButtonFilter));

			if (Array.isArray(callButtonParent))
				if (!callButtonParent.some(button => button?.props?.id === config.info.slug))
					// Splice in our own logic above the call-button
					callButtonParent.splice(callButtonParent.findIndex(callButtonFilter), 0, this.rightClickJoinMagic(props.user));
		});
	}


	rightClickJoinMagic(user) {
		const voiceStateForUser = this.VoiceStateStore.getVoiceStateForUser(user.id),
			checkVoiceAndBuildItem = (voiceState) => {
				if (voiceState = this.VoiceStateStore.getVoiceStateForUser(user.id))
					return ContextMenu.buildItem({
						label: "Join Call",
						id: config.info.menuID,
						action: () => {
							this.selectVoiceChannel(voiceState.channelId);
						}
					});
			};

		if (!voiceStateForUser) {
			if (this.UserProfileStore.isFetchingProfile(user.id) ||
				this.Dispatcher.isDispatching())
				return null;

			this.Dispatcher.wait(() => {
				UserFetchActions.fetchProfile(user.id)
			});
		}
		
		return checkVoiceAndBuildItem(voiceStateForUser);
	}
};

// Thank you Strencher
const UserFetchActions = new class UserFetchActions {
	_module = null;
	_moduleString = "";
	_nativeFetchProfile = () => { };
	_nativeFetchFriends = () => { };

	unwrapApply(variable) {
		const regex = new RegExp(String.raw`function (\w+)\([\w,]+\)\{return ${variable}.apply\(this,arguments\)\}`);

		return regex.exec(this._moduleString)?.[1];
	}

	findExportByVariable(variable) {
		const regex = new RegExp(String.raw`(\w+):\(\)=>${variable},?`);

		return regex.exec(this._moduleString)?.[1];
	}

	parseExports() {
		const fetchProfileRegex = /function (\w+)\(\)\{\w=[\s\S]+?switch\(\w\.label\)\{[\s\S]+?type\:\"USER_PROFILE_FETCH_START\",userId\:/;

		if (fetchProfileRegex.test(this._moduleString)) {
			// This finds the function's name that contains our "fetchProfile" function
			const variable = fetchProfileRegex.exec(this._moduleString)?.[1];
			// This finds the wrapper function's name
			const unwrapped = this.unwrapApply(variable);

			// This finds the exported function that wraps the wrapper (why?)
			this._nativeFetchProfile = this._module[this.findExportByVariable(unwrapped)];
		}

		const fetchFriendsRegex = /function (\w+)\(\)\{return\(\w=.+?switch\(\w\.label\)\{[\S\s]+?type:"MUTUAL_FRIENDS_FETCH_START",userId:/;

		if (fetchFriendsRegex.test(this._moduleString)) {
			const variable = fetchFriendsRegex.exec(this._moduleString)?.[1];
			const unwrapped = this.unwrapApply(variable);

			this._nativeFetchFriends = this._module[this.findExportByVariable(unwrapped)];
		}
	}

	initialize() {
		// Get the module with the export by ID that contains our fetchProfile
		// Saves it as a string to dissect
		this._module = Webpack.getModule((m, _t, id) => (this._moduleString = Webpack.modules[id]?.toString()).includes("UserProfileModalActionCreators"));

		if (!this._module) return; // TODO: Error

		this.parseExports();
	}

	fetchProfile(userId, options) {
		return this._nativeFetchProfile(userId, options);
	}

	fetchMutualFriends(userId) {
		return this._nativeFetchFriends(userId);
	}
};
