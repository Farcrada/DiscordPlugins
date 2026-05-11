/**
 * @name Double Click To Edit
 * @author Farcrada, original idea by Jiiks
 * @version 9.4.11
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
			this.selectedClass = Webpack.getModule(Filters.byKeys("message", "selected"))?.selected;

			//Copy to clipboard
			this.copyToClipboard = (text) => {
				if (window.DiscordNative?.clipboard?.copy)
					window.DiscordNative.clipboard.copy(text);
				else
					navigator.clipboard?.writeText?.(text);
			};


			//Stores
			this.MessageStore = Webpack.getModule(Filters.byKeys("receiveMessage", "editMessage"));
			const messageDataStore = Webpack.getModule(Filters.byKeys("getMessage", "getMessages"));
			this.getMessage = messageDataStore?.getMessage?.bind(messageDataStore);
			this.CurrentUserStore = Webpack.getModule(Filters.byKeys("getCurrentUser"));

			//Events
			global.document.addEventListener('dblclick', this.doubleclickFunc);
			global.document.addEventListener('click', this.altClickSuppressor, true);

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

	altClickSuppressor = (e) => {
		if (!e.altKey) return;
		const altIsPluginModifier =
			(this.doubleClickToEditModifier && this.editModifier === "alt") ||
			(this.doubleClickToReplyModifier && this.replyModifier === "alt") ||
			(this.doubleClickToCopy && this.copyModifier === "alt");
		if (!altIsPluginModifier) return;
		if (!e.target?.closest?.('[data-list-item-id^="chat-messages"]')) return;
		e.stopImmediatePropagation();
		e.preventDefault();
	};

	stop = () => {
		document.removeEventListener('dblclick', this.doubleclickFunc);
		document.removeEventListener('click', this.altClickSuppressor, true);
	};

	getSettingsPanel() {
		const modifierOptions = [
			{ name: "Shift", value: "shift" },
			{ name: "Ctrl", value: "ctrl" },
			{ name: "Alt", value: "alt" }
		];

		return BdApi.UI.buildSettingsPanel({
			settings: [
				//Edit
				{
					type: "switch",
					id: "doubleClickToEditModifier",
					name: "Enable Edit Modifier",
					note: "Enable modifier for double clicking to edit",
					value: this.doubleClickToEditModifier
				},
				{
					type: "radio",
					id: "editModifier",
					name: "Modifier to hold to edit a message",
					value: this.editModifier,
					options: modifierOptions
				},
				//Reply
				{
					type: "switch",
					id: "doubleClickToReply",
					name: "Enable Replying",
					note: "Double click another's message and start replying.",
					value: this.doubleClickToReply
				},
				{
					type: "switch",
					id: "doubleClickToReplyModifier",
					name: "Enable Reply Modifier",
					note: "Enable modifier for double clicking to reply",
					value: this.doubleClickToReplyModifier
				},
				{
					type: "radio",
					id: "replyModifier",
					name: "Modifier to hold when replying to a message",
					value: this.replyModifier,
					options: modifierOptions
				},
				//Copy
				{
					type: "switch",
					id: "doubleClickToCopy",
					name: "Enable Copying",
					note: "Copy selection before entering edit-mode.",
					value: this.doubleClickToCopy
				},
				{
					type: "radio",
					id: "copyModifier",
					name: "Modifier to hold before copying text",
					value: this.copyModifier,
					options: modifierOptions
				}
			],
			onChange: (_category, id, value) => {
				this[id] = value;
				Data.save(config.info.slug, id, value);
			}
		});
	}

	handler(e) {
		if (typeof (e?.target?.className) !== typeof ("") ||
			ignore.some(nameOfClass => e?.target?.className?.indexOf?.(nameOfClass) > -1))
			return;

		//Target the message
		const messageDiv = e.target.closest(
			'[data-list-item-id^="chat-messages"], ' +
			'article[class*="message"], ' +
			'div[class*="messageContainer"], ' +
			'li > div[class*="message"], ' +
			'li[class*="message"]'
		);
		
		//If it finds nothing, null it.
		if (!messageDiv)
			return;
		//Make sure we're not resetting when the message is already in edit-mode.
		if (messageDiv.classList.contains(this.selectedClass))
			return;

		let message;
		const dataIdEl = messageDiv.matches('[data-list-item-id^="chat-messages"]')
			? messageDiv
			: messageDiv.closest('[data-list-item-id^="chat-messages"]');
		const dataId = dataIdEl?.getAttribute('data-list-item-id');
		const idMatch = dataId?.match(/chat-messages[_-](\d+)[_-](\d+)/);
		if (idMatch && this.getMessage)
			message = this.getMessage(idMatch[1], idMatch[2]);

		if (!message) {
			const instance = ReactUtils.getInternalInstance(messageDiv);
			if (instance)
				message = Utils.findInTree(instance, m => m?.baseMessage, { walkable: walkable })?.baseMessage ??
					Utils.findInTree(instance, m => m?.message, { walkable: walkable })?.message;
		}

		if (!message)
			return;

		if (this.checkForModifier(this.doubleClickToCopy, this.copyModifier, e))
			this.copyToClipboard(message.content);

		const editKeyHeld = this.checkForModifier(this.doubleClickToEditModifier, this.editModifier, e),
			replyKeyHeld = this.checkForModifier(this.doubleClickToReplyModifier, this.replyModifier, e);

		//If a modifier is enabled, check if the key is held, otherwise ignore.
		if ((this.doubleClickToEditModifier ? editKeyHeld : true) && message.author.id === this.CurrentUserStore.getCurrentUser().id)
			this.MessageStore.startEditMessage(message.channel_id, message.id, message.content);
		else if ((this.doubleClickToReplyModifier ? replyKeyHeld : true) && this.doubleClickToReply) {
			const replyBtn = messageDiv.querySelector('[aria-label="Reply"]')
				?? messageDiv.closest('li')?.querySelector('[aria-label="Reply"]');
			replyBtn?.click();
		}
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
