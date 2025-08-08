/**
 * @name Double Click To Edit
 * @author Farcrada, original idea by Jiiks
 * @version 9.4.10
 * @description Double click a message you wrote to quickly edit it.
 * 
 * @invite qH6UWCwfTu
 * @website https://github.com/Farcrada/DiscordPlugins/
 * @source https://github.com/Farcrada/DiscordPlugins/blob/master/Double-click-to-edit/DoubleClickToEdit.plugin.js
 * @updateUrl https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Double-click-to-edit/DoubleClickToEdit.plugin.js
 */

/** @type {typeof import("react")} */
const React = BdApi.React,

	{ Webpack, Webpack: { Filters }, Data, Utils, ReactUtils } = BdApi,

	config = {},

	ignore = [
		//Object
		"video",
		"emoji",
		//Classes
		"content",
		"reactionInner"
	],
	walkable = [
		"child",
		"memoizedProps",
		"sibling"
	];


module.exports = class DoubleClickToEdit {


	constructor(meta) { config.info = meta; }

	start() {
		try {
			//Classes
			this.selectedClass = Webpack.getModule(Filters.byKeys("message", "selected")).selected;
			this.messagesWrapper = Webpack.getModule(Filters.byKeys("empty", "messagesWrapper")).messagesWrapper;

			//Copy to clipboard
			this.copyToClipboard = Webpack.getModule(Filters.byKeys("clipboard", "app")).clipboard.copy;

			//Reply functions
			this.replyToMessage = Webpack.getModule(m => m?.toString?.()?.replace('\n', '')?.search(/(channel:e,message:n,shouldMention:!)/) > -1, { searchExports: true })
			this.getChannel = Webpack.getModule(Filters.byKeys("getChannel", "getDMFromUserId")).getChannel;

			//Stores
			this.MessageStore = Webpack.getModule(Filters.byKeys("receiveMessage", "editMessage"));
			this.CurrentUserStore = Webpack.getModule(Filters.byKeys("getCurrentUser"));

			//Settings
			this.FormSwitch = Webpack.getModule(Filters.byStrings('labelRow', 'checked'), { searchExports: true });
			this.RadioGroup = Webpack.getModule(m => Filters.byKeys('NOT_SET', 'NONE')(m?.Sizes), { searchExports: true });
			this.FormItem = Webpack.getModule(m => Filters.byStrings('titleId', 'errorId', 'setIsFocused')(m?.render), { searchExports: true });

			//Events
			global.document.addEventListener('dblclick', this.doubleclickFunc);

			//Load settings
			//Edit
			this.doubleClickToEditModifier = Data.load(config.info.slug, "doubleClickToEditModifier") ?? false;
			this.editModifier = Data.load(config.info.slug, "editModifier") ?? "shift";
			//Reply
			this.doubleClickToReply = Data.load(config.info.slug, "doubleClickToReply") ?? false;
			this.doubleClickToReplyModifier = Data.load(config.info.slug, "doubleClickToReplyModifier") ?? false;
			this.replyModifier = Data.load(config.info.slug, "replyModifier") ?? "shift";
			//Copy
			this.doubleClickToCopy = Data.load(config.info.slug, "doubleClickToCopy") ?? false;
			this.copyModifier = Data.load(config.info.slug, "copyModifier") ?? "shift";

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
				React.createElement(this.FormSwitch, {
					//The state that is loaded with the default value
					value: editEnableModifier,
					note: "Enable modifier for double clicking to edit",
					//Since onChange passes the current state we can simply invoke it as such
					onChange: (newState) => {
						//Saving the new state
						this.doubleClickToEditModifier = newState;
						Data.save(config.info.slug, "doubleClickToEditModifier", newState);
						setEditEnableModifier(newState);
					}
					//Discord Is One Of Those
				}, "Enable Edit Modifier"),
				React.createElement(this.FormItem, {
					disabled: !editEnableModifier,
					title: "Modifer to hold to edit a message"
				},
					React.createElement(this.RadioGroup, {
						disabled: !editEnableModifier,
						value: editModifier,
						options: [
							{ name: "Shift", value: "shift" },
							{ name: "Ctrl", value: "ctrl" },
							{ name: "Alt", value: "alt" }
						],
						onChange: (newState) => {
							this.editModifier = newState.value;
							Data.save(config.info.slug, "editModifier", newState.value);
							setEditModifier(newState.value);
						}
					})),

				//Reply
				React.createElement(this.FormSwitch, {
					value: reply,
					note: "Double click another's message and start replying.",
					onChange: (newState) => {
						this.doubleClickToReply = newState;
						Data.save(config.info.slug, "doubleClickToReply", newState);
						setReply(newState);
					}
				}, "Enable Replying"),
				React.createElement(this.FormSwitch, {
					disabled: !reply,
					value: replyEnableModifier,
					note: "Enable modifier for double clicking to reply",
					onChange: (newState) => {
						this.doubleClickToReplyModifier = newState;
						Data.save(config.info.slug, "doubleClickToReplyModifier", newState);
						setReplyEnableModifier(newState);
					}
				}, "Enable Reply Modifier"),
				React.createElement(this.FormItem, {
					disabled: (!reply || !replyEnableModifier),
					title: "Modifier to hold when replying to a message"
				},
					React.createElement(this.RadioGroup, {
						disabled: (!reply || !replyEnableModifier),
						value: replyModifier,
						options: [
							{ name: "Shift", value: "shift" },
							{ name: "Ctrl", value: "ctrl" },
							{ name: "Alt", value: "alt" }
						],
						onChange: (newState) => {
							this.replyModifier = newState.value;
							Data.save(config.info.slug, "replyModifier", newState.value);
							setReplyModifier(newState.value);
						}
					})),

				//Copy
				React.createElement(this.FormSwitch, {
					value: copy,
					note: "Copy selection before entering edit-mode.",
					onChange: (newState) => {
						this.doubleClickToCopy = newState;
						Data.save(config.info.slug, "doubleClickToCopy", newState);
						setCopy(newState);
					}
				}, "Enable Copying"),
				React.createElement(this.FormItem, {
					disabled: !copy,
					title: "Modifier to hold before copying text"
				},
					React.createElement(this.RadioGroup, {
						disabled: !copy,
						value: copyModifier,
						options: [
							{ name: "Shift", value: "shift" },
							{ name: "Ctrl", value: "ctrl" },
							{ name: "Alt", value: "alt" }
						],
						onChange: (newState) => {
							this.copyModifier = newState.value;
							Data.save(config.info.slug, "copyModifier", newState.value);
							setCopyModifier(newState.value);
						}
					}))
			];
		}
	}

	handler(e) {
		//Check if we're not double clicking
		if (typeof (e?.target?.className) !== typeof ("") ||
			ignore.some(nameOfClass => e?.target?.className?.indexOf?.(nameOfClass) > -1))
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
		const instance = ReactUtils.getInternalInstance(messageDiv);
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
		const message = Utils.findInTree(instance, m => m?.baseMessage, { walkable: walkable })?.baseMessage ??
			Utils.findInTree(instance, m => m?.message, { walkable: walkable })?.message;

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
}
