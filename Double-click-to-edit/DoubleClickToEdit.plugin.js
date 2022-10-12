/**
 * @name Double Click To Edit
 * @author Farcrada, original idea by Jiiks
 * @version 9.4.0
 * @description Double click a message you wrote to quickly edit it.
 * 
 * @invite qH6UWCwfTu
 * @website https://github.com/Farcrada/DiscordPlugins/
 * @source https://github.com/Farcrada/DiscordPlugins/blob/master/Double-click-to-edit/DoubleClickToEdit.plugin.js
 * @updateUrl https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Double-click-to-edit/DoubleClickToEdit.plugin.js
 */

/** @type {typeof import("react")} */
const React = BdApi.React,

	Webpack = BdApi.Webpack,
	Filters = BdApi.Webpack.Filters,

	config = {
		info: {
			name: "Double Click To Edit",
			id: "DoubleClickToEdit",
			description: "Double click a message you wrote to quickly edit it",
			version: "9.4.0",
			author: "Farcrada",
			updateUrl: "https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Double-click-to-edit/DoubleClickToEdit.plugin.js"
		}
	};

const blacklist = [
	//Object
	"video",
	"emoji",
	//Classes
	"content",
	"reactionInner"
];


module.exports = class DoubleClickToEdit {


	load() {
		try { global.ZeresPluginLibrary.PluginUpdater.checkForUpdate(config.info.name, config.info.version, config.info.updateUrl); }
		catch (err) { console.error(config.info.name, "Failed to reach the ZeresPluginLibrary for Plugin Updater.", err); }
	}

	start() {
		try {
			//Classes
			this.selectedClass = BdApi.findModuleByProps("message", "selected").selected;
			this.messagesWrapper = BdApi.findModuleByProps("empty", "messagesWrapper").messagesWrapper;

			//Copy to clipboard
			this.copyToClipboard = BdApi.findModuleByProps("clipboard", "app").clipboard.copy;

			//Reply functions
			this.replyToMessage = Webpack.getModule(Filters.byStrings("dispatchToLastSubscribed(", "isPrivate()"), { searchExports: true });
			this.getChannel = Webpack.getModule(Filters.byProps("getChannel", "getDMFromUserId")).getChannel;

			//Stores
			this.MessageStore = BdApi.findModuleByProps("receiveMessage", "editMessage");
			this.CurrentUserStore = BdApi.findModuleByProps("getCurrentUser");
			this.Dispatcher = BdApi.findModule(m => m.dispatch && m._interceptor);
			this.UserStore = BdApi.findModuleByProps("getUser", "getUsers");

			//Settings
			this.SwitchItem = BdApi.findModule(m => m.toString().includes("t=e.value,r=e.disabled"));

			//Events
			global.document.addEventListener('dblclick', this.doubleclickFunc);

			//Load settings
			this.doubleClickToReplySetting = BdApi.loadData(config.info.id, "doubleClickToReplySetting") ?? false;
			this.copyBeforeAction = BdApi.loadData(config.info.id, "copyBeforeAction") ?? false;
		}
		catch (err) {
			try {
				console.error("Attempting to stop after starting error...", err);
				this.stop();
			}
			catch (err) {
				console.error(config.info.name + ".stop()", err);
			}
		}
	}

	//By doing this we make sure we're able to remove our event
	//otherwise it gets stuck on the page and never actually unloads.
	doubleclickFunc = (e) => this.handler(e);

	stop = () => document.removeEventListener('dblclick', this.doubleclickFunc);

	getSettingsPanel() {
		//Anonymous function to preserve the this scope,
		//which also makes it an anonymous functional component;
		//Pretty neat.
		return () => {
			const [replyState, setReplyState] = React.useState(this.doubleClickToReplySetting),
				[copyState, setCopyState] = React.useState(this.copyBeforeAction);

			return [
				React.createElement(this.SwitchItem, {
					//The state that is loaded with the default value
					value: replyState,
					note: "Double click another's message and start replying.",
					//Since onChange passes the current state we can simply invoke it as such
					onChange: (newState) => {
						//Saving the new state
						this.doubleClickToReplySetting = newState;
						BdApi.saveData(config.info.id, "doubleClickToReplySetting", newState);
						setReplyState(newState);
					}
					//Discord Is One Of Those
				}, "Enable Replying"),
				React.createElement(this.SwitchItem, {
					//The state that is loaded with the default value
					value: copyState,
					note: "Copy selection before entering edit-mode.",
					//Since onChange passes the current state we can simply invoke it as such
					onChange: (newState) => {
						//Saving the new state
						this.copyBeforeAction = newState;
						BdApi.saveData(config.info.id, "copyBeforeAction", newState);
						setCopyState(newState);
					}
					//Discord Is One Of Those
				}, "Enable Copying")
			];
		}
	}

	handler(e) {
		//Check if we're not double clicking
		if (typeof (e?.target?.className) !== typeof ("") ||
			blacklist.some(nameOfClass => e?.target?.className?.indexOf?.(nameOfClass) > -1))
			return;

		//Target the message
		const messageDiv = e.target.closest('li > [class^=message]');

		//If it finds nothing, null it.
		if (!messageDiv)
			return;
		//Make sure we're not resetting when the message is already in edit-mode.
		if (messageDiv.classList.contains(this.selectedClass))
			return;

		//Basically make a HTMLElement/Node interactable with it's React components.
		const instance = BdApi.getInternalInstance(messageDiv);
		//Mandatory nullcheck
		if (!instance)
			return;

		//When selecting text it might be handy to have it auto-copy.
		if (this.copyBeforeAction)
			this.copyToClipboard(document.getSelection().toString());

		//The message instance is filled top to bottom, as it is in view.
		//As a result, "baseMessage" will be the actual message you want to address. And "message" will be the reply.
		//Maybe the message has a reply, so check if "baseMessage" exists and otherwise fallback on "message".
		const message = this.getValueFromKey(instance, "baseMessage") ?? this.getValueFromKey(instance, "message");

		if (!message)
			return;

		if (message.author.id === this.CurrentUserStore.getCurrentUser().id)
			this.MessageStore.startEditMessage(message.channel_id, message.id, message.content);
		else if (this.doubleClickToReplySetting)
			this.replyToMessage(this.getChannel(message.channel_id), message, e);
	}

	getValueFromKey(instance, searchkey) {
		//Where we want to search.
		const whitelist = {
			memoizedProps: true,
			child: true,
			sibling: true
		};

		return function getKey(instance) {
			//Pre-define
			let result = undefined;
			//Make sure it exists and isn't a "paradox".
			if (instance && !Node.prototype.isPrototypeOf(instance)) {
				//Get our own keys
				const keys = Object.getOwnPropertyNames(instance);
				//As long as we don't have a result, lets go through.
				for (let i = 0; result === undefined && i < keys.length; i++) {
					//Store our key for readability
					const key = keys[i];
					//Check if there is a key
					if (key) {
						//Store the value
						const value = instance[key];
						//Is our key what we want?
						if (searchkey === key)
							result = value;
						//Otherwise check if the value of a key is something we can search through
						//and whitelisted; of course.
						else if ((typeof value === "object" || typeof value === "function") &&
							(whitelist[key] || key[0] == "." || !isNaN(key[0])))
							//Lets go nesting; lets go!
							result = getKey(value);
					}
				}
			}
			//If a poor sod got found this will not be `undefined`
			return result;
			//Start our mayhem
		}(instance);
	}
}
