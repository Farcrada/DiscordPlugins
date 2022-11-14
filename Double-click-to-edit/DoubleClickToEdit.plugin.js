/**
 * @name Double Click To Edit
 * @author Farcrada, original idea by Jiiks
 * @version 9.4.3
 * @description Double click a message you wrote to quickly edit it.
 * 
 * @invite qH6UWCwfTu
 * @website https://github.com/Farcrada/DiscordPlugins/
 * @source https://github.com/Farcrada/DiscordPlugins/blob/master/Double-click-to-edit/DoubleClickToEdit.plugin.js
 * @updateUrl https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Double-click-to-edit/DoubleClickToEdit.plugin.js
 */

/** @type {typeof import("react")} */
const React = BdApi.React,

	{ Webpack, Webpack: { Filters } } = BdApi,

	config = {
		info: {
			name: "Double Click To Edit",
			id: "DoubleClickToEdit",
			description: "Double click a message you wrote to quickly edit it",
			version: "9.4.3",
			author: "Farcrada",
			updateUrl: "https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Double-click-to-edit/DoubleClickToEdit.plugin.js"
		}
	},

	blacklist = [
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
			this.selectedClass = Webpack.getModule(Filters.byProps("message", "selected")).selected;
			this.messagesWrapper = Webpack.getModule(Filters.byProps("empty", "messagesWrapper")).messagesWrapper;

			//Copy to clipboard
			this.copyToClipboard = Webpack.getModule(Filters.byProps("clipboard", "app")).clipboard.copy;

			//Reply functions
			this.replyToMessage = Webpack.getModule(m => m?.toString?.()?.replace('\n', '')?.search(/(channel:[\w|\w],message:[\w|\w],shouldMention:!)/) > -1, { searchExports: true })
			this.getChannel = Webpack.getModule(Filters.byProps("getChannel", "getDMFromUserId")).getChannel;

			//Stores
			this.MessageStore = Webpack.getModule(Filters.byProps("receiveMessage", "editMessage"));
			this.CurrentUserStore = Webpack.getModule(Filters.byProps("getCurrentUser"));

			//Settings
			const filter = Webpack.Filters.byStrings(`["tag","children","className","faded","disabled","required","error"]`),
				target = Webpack.getModule(m => Object.values(m).some(filter));
			this.FormTitle = target[Object.keys(target).find(k => filter(target[k]))];
			this.RadioItem = Webpack.getModule(m => m?.Sizes?.NONE, { searchExports: true });
			this.SwitchItem = Webpack.getModule(Filters.byStrings("=e.note"));


			//Events
			global.document.addEventListener('dblclick', this.doubleclickFunc);

			//Load settings
			this.doubleClickToReplySetting = BdApi.loadData(config.info.id, "doubleClickToReplySetting") ?? false;
			this.editActionKey = 
			this.copyBeforeAction = BdApi.loadData(config.info.id, "copyBeforeAction") ?? false;
			this.copyBeforeActionModifier = BdApi.loadData(config.info.id, "copyBeforeActionModifier") ?? "shift";
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
				[replyActionKeyState, setReplyActionKeyState] = React.useState(this.replyActionKey),
				[editActionKeyState, setEditActionKeyState] = React.useState(this.editActionKey),
				[copyState, setCopyState] = React.useState(this.copyBeforeAction),
				[copyModifierState, setCopyModifierState] = React.useState(this.copyBeforeActionModifier);

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

				React.createElement(this.FormTitle, {
					tag: "h3",
				}, "Key to hold when editing a message"),
				//Allow the user to control when they edit a message
				React.createElement(this.RadioItem, {
					value: editActionKeyState,
					options: [
						{ name: "None", value: "none" },
						{ name: "Shift", value: "shift" },
						{ name: "Ctrl", value: "ctrl" },
						{ name: "Any", value: "any" }
					],
					onChange: (newState) => {
						this.editActionKey = newState.value;
						BdApi.saveData(config.info.id, "editActionKey", newState.value);
						setEditActionKeyState(newState.value);
					}
					//Discord Is One Of Those (i have no clue what that means, but pop off ig)
				}, "Edit ActionKey"),

				React.createElement(this.FormTitle, {
					tag: "h3",
					disabled: !replyState
				}, "Key to hold when replying to a message"),
				//Allow the user to control when they reply to a message
				React.createElement(this.RadioItem, {
					disabled: !replyState,
					value: replyActionKeyState,
					options: [
						{ name: "None", value: "none" },
						{ name: "Shift", value: "shift" },
						{ name: "Ctrl", value: "ctrl" },
						{ name: "Any", value: "any" }
					],
					onChange: (newState) => {
						this.replyActionKey = newState.value;
						BdApi.saveData(config.info.id, "replyActionKey", newState.value);
						setReplyActionKeyState(newState.value);
					}
				}, "Reply ActionKey"),

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
				}, "Enable Copying"),

				React.createElement(this.FormTitle, {
					tag: "h3",
					disabled: !copyState
				}, "Modifier to hold before copying text"),
				React.createElement(this.RadioItem, {
					disabled: !copyState,
					value: copyModifierState,
					options: [
						{ name: "Shift", value: "shift" },
						{ name: "Ctrl", value: "ctrl" },
						{ name: "Alt", value: "alt" }
					],
					onChange: (newState) => {
						this.copyBeforeActionModifier = newState.value;
						BdApi.saveData(config.info.id, "copyBeforeActionModifier", newState.value);
						setCopyModifierState(newState.value);
					}
				}, "Copy Modifier")
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
			switch (this.copyBeforeActionModifier) {
				case "shift": if (!e.shiftKey) break;
					this.copyToClipboard(document.getSelection().toString());
					break;
				case "ctrl": if (!e.ctrlKey) break;
					this.copyToClipboard(document.getSelection().toString());
					break;
				case "alt": if (!e.altKey) break;
					this.copyToClipboard(document.getSelection().toString());
					break;
			}

		//The message instance is filled top to bottom, as it is in view.
		//As a result, "baseMessage" will be the actual message you want to address. And "message" will be the reply.
		//Maybe the message has a reply, so check if "baseMessage" exists and otherwise fallback on "message".
		const message = this.getValueFromKey(instance, "baseMessage") ?? this.getValueFromKey(instance, "message");

		if (!message)
			return;

		//Check if we're holding down the reply action key
		let replyKeyHeld = false;
		switch (this.replyActionKey) {
			case "shift": replyKeyHeld = e.shiftKey; break;
			case "ctrl": replyKeyHeld = e.ctrlKey; break;
			case "alt": replyKeyHeld = e.altKey; break;
			case "none": replyKeyHeld = !e.altKey && !e.ctrlKey && !e.shiftKey; break;
			case "any": replyKeyHeld = true; break;
		}

		//Now we do the same thing with the edit action key
		let editKeyHeld = false;
		switch (this.editActionKey) {
			case "shift": editKeyHeld = e.shiftKey; break;
			case "ctrl": editKeyHeld = e.ctrlKey; break;
			case "alt": editKeyHeld = e.altKey; break;
			case "none": editKeyHeld = !e.altKey && !e.ctrlKey && !e.shiftKey; break;
			case "any": editKeyHeld = true; break;
		}

		//If the edit reply key is any, and the reply key is held, we want the reply to be preferred. Otherwise, we want the edit to be preferred.
		if (replyKeyHeld && (!editKeyHeld || this.editActionKey === "any" && this.replyActionKey !== "any" || message.author.id !== this.CurrentUserStore.getCurrentUser().id))
			this.replyToMessage(this.getChannel(message.channel_id), message, e);
		else if (editKeyHeld && message.author.id === this.CurrentUserStore.getCurrentUser().id)
			this.MessageStore.startEditMessage(message.channel_id, message.id, message.content);
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
