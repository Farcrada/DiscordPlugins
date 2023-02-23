/**
 * @name Double Click To Edit
 * @author Farcrada, original idea by Jiiks
 * @version 9.4.5
 * @description Double click a message you wrote to quickly edit it.
 * 
 * @invite qH6UWCwfTu
 * @website https://github.com/Farcrada/DiscordPlugins/
 * @source https://github.com/Farcrada/DiscordPlugins/blob/master/Double-click-to-edit/DoubleClickToEdit.plugin.js
 * @updateUrl https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Double-click-to-edit/DoubleClickToEdit.plugin.js
 */

/** @type {typeof import("react")} */
const React = BdApi.React,

	{ Webpack, Webpack: { Filters }, Data } = BdApi,

	config = {
		info: {
			name: "Double Click To Edit",
			id: "DoubleClickToEdit",
			description: "Double click a message you wrote to quickly edit it",
			version: "9.4.5",
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
			this.SwitchItem = Webpack.getModule(Filters.byStrings("=e.note", "checked:"), { searchExports: true });


			//Events
			global.document.addEventListener('dblclick', this.doubleclickFunc);

			//Load settings
			//Edit
			this.doubleClickToEditModifier = Data.load(config.info.id, "doubleClickToEditModifier") ?? false;
			this.editModifier = Data.load(config.info.id, "editModifier") ?? "shift";
			//Reply
			this.doubleClickToReply = Data.load(config.info.id, "doubleClickToReply") ?? false;
			this.doubleClickToReplyModifier = Data.load(config.info.id, "doubleClickToReplyModifier") ?? false;
			this.replyModifier = Data.load(config.info.id, "replyModifier") ?? "shift";
			//Copy
			this.doubleClickToCopy = Data.load(config.info.id, "doubleClickToCopy") ?? false;
			this.copyModifier = Data.load(config.info.id, "copyModifier") ?? "shift";

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
			//Edit
			const [editEnableModifier, setEditEnableModifier] = React.useState(this.doubleClickToEditModifier),
				[editModifier, setEditModifier] = React.useState(this.editModifier),
				//Reply
				[reply, setReply] = React.useState(this.doubleClickToReply),
				[replyEnableModifier, setReplyEnableModifier] = React.useState(this.doubleClickToReplyModifier),
				[replyModifier, setReplyModifier] = React.useState(this.replyModifier),
				//Copy
				[copy, setCopy] = React.useState(this.doubleClickToCopy),
				[copyModifier, setCopyModifier] = React.useState(this.copyModifier);

			return [
				//Edit
				React.createElement(this.SwitchItem, {
					//The state that is loaded with the default value
					value: editEnableModifier,
					note: "Enable modifier for double clicking to edit",
					//Since onChange passes the current state we can simply invoke it as such
					onChange: (newState) => {
						//Saving the new state
						this.doubleClickToEditModifier = newState;
						Data.save(config.info.id, "doubleClickToEditModifier", newState);
						setEditEnableModifier(newState);
					}
					//Discord Is One Of Those
				}, "Enable Edit Modifier"),
				React.createElement(this.FormTitle, {
					disabled: !editEnableModifier,
					tag: "h3"
				}, "Modifer to hold to edit a message"),
				React.createElement(this.RadioItem, {
					disabled: !editEnableModifier,
					value: editModifier,
					options: [
						{ name: "Shift", value: "shift" },
						{ name: "Ctrl", value: "ctrl" },
						{ name: "Alt", value: "alt" }
					],
					onChange: (newState) => {
						this.editModifier = newState.value;
						Data.save(config.info.id, "editModifier", newState.value);
						setEditModifier(newState.value);
					}
				}),

				//Reply
				React.createElement(this.SwitchItem, {
					value: reply,
					note: "Double click another's message and start replying.",
					onChange: (newState) => {
						this.doubleClickToReply = newState;
						Data.save(config.info.id, "doubleClickToReply", newState);
						setReply(newState);
					}
				}, "Enable Replying"),
				React.createElement(this.SwitchItem, {
					disabled: !reply,
					value: replyEnableModifier,
					note: "Enable modifier for double clicking to reply",
					onChange: (newState) => {
						this.doubleClickToReplyModifier = newState;
						Data.save(config.info.id, "doubleClickToReplyModifier", newState);
						setReplyEnableModifier(newState);
					}
				}, "Enable Reply Modifier"),
				React.createElement(this.FormTitle, {
					disabled: (!reply || !replyEnableModifier),
					tag: "h3"
				}, "Modifier to hold when replying to a message"),
				React.createElement(this.RadioItem, {
					disabled: (!reply || !replyEnableModifier),
					value: replyModifier,
					options: [
						{ name: "Shift", value: "shift" },
						{ name: "Ctrl", value: "ctrl" },
						{ name: "Alt", value: "alt" }
					],
					onChange: (newState) => {
						this.replyModifier = newState.value;
						Data.save(config.info.id, "replyModifier", newState.value);
						setReplyModifier(newState.value);
					}
				}),

				//Copy
				React.createElement(this.SwitchItem, {
					value: copy,
					note: "Copy selection before entering edit-mode.",
					onChange: (newState) => {
						this.doubleClickToCopy = newState;
						Data.save(config.info.id, "doubleClickToCopy", newState);
						setCopy(newState);
					}
				}, "Enable Copying"),
				React.createElement(this.FormTitle, {
					disabled: !copy,
					tag: "h3"
				}, "Modifier to hold before copying text"),
				React.createElement(this.RadioItem, {
					disabled: !copy,
					value: copyModifier,
					options: [
						{ name: "Shift", value: "shift" },
						{ name: "Ctrl", value: "ctrl" },
						{ name: "Alt", value: "alt" }
					],
					onChange: (newState) => {
						this.copyModifier = newState.value;
						Data.save(config.info.id, "copyModifier", newState.value);
						setCopyModifier(newState.value);
					}
				})
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

		//When selecting text it might be useful to copy.
		const copyKeyHeld = this.checkForModifier(this.doubleClickToCopy, this.copyModifier, e);
		if (copyKeyHeld)
			this.copyToClipboard(document.getSelection().toString());

		//The message instance is filled top to bottom, as it is in view.
		//As a result, "baseMessage" will be the actual message you want to address. And "message" will be the reply.
		//Maybe the message has a reply, so check if "baseMessage" exists and otherwise fallback on "message".
		const message = this.getValueFromKey(instance, "baseMessage") ?? this.getValueFromKey(instance, "message");

		if (!message)
			return;

		//Now we do the same thing with the edit and reply modifier
		const editKeyHeld = this.checkForModifier(this.doubleClickToEditModifier, this.editModifier, e),
			replyKeyHeld = this.checkForModifier(this.doubleClickToReplyModifier, this.replyModifier, e);

		//If a modifier is enabled, check if the key is held, otherwise ignore.
		if ((this.doubleClickToEditModifier ? editKeyHeld : true) && message.author.id === this.CurrentUserStore.getCurrentUser().id)
			this.MessageStore.startEditMessage(message.channel_id, message.id, message.content);
		else if ((this.doubleClickToReplyModifier ? replyKeyHeld : true) && this.doubleClickToReply)
			this.replyToMessage(this.getChannel(message.channel_id), message, e);
	}

	/**
	 * 
	 * @param {boolean} enabled Is the modifier enabled
	 * @param {string} modifier Modifier key to be checked for
	 * @param {Event} event The event checked against
	 * @returns {boolean} Whether the modifier is enabled and the modifier is pressed
	 */
	checkForModifier(enabled, modifier, event) {
		if (enabled)
			switch (modifier) {
				case "shift": return event.shiftKey;
				case "ctrl": return event.ctrlKey;
				case "alt": return event.altKey;
			}
		return false;
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
