/**
 * @name DoubleClickToEdit
 * @author Farcrada
 * @version 9.3.6
 * @description Double click a message you wrote to quickly edit it.
 * 
 * @website https://github.com/Farcrada/DiscordPlugins/
 * @source https://github.com/Farcrada/DiscordPlugins/blob/master/Double-click-to-edit/DoubleClickToEdit.plugin.js
 * @updateUrl https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Double-click-to-edit/DoubleClickToEdit.plugin.js
*/

/** @type {typeof import("react")} */
const React = BdApi.React;

const config = {
	info: {
		name: "Double Click To Edit",
		id: "DoubleClickToEdit",
		description: "Double click a message you wrote to quickly edit it",
		version: "9.3.6",
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

	//I like my spaces. 
	getName() { return config.info.name; }
	getAuthor() { return `${config.info.author}, original idea by Jiiks`; }


	load() {
		try { global.ZeresPluginLibrary.PluginUpdater.checkForUpdate(config.info.name, config.info.version, config.info.updateUrl); }
		catch (err) { console.error(this.getName(), "Failed to reach the ZeresPluginLibrary for Plugin Updater.", err); }
	}

	start() {
		try {
			//Classes
			this.selectedClass = BdApi.findModuleByProps("message", "selected").selected;
			this.messagesWrapper = BdApi.findModuleByProps("empty", "messagesWrapper").messagesWrapper;

			//Copy to clipboard
			this.copyToClipboard = BdApi.findModuleByProps("clipboard").clipboard.copy;

			//Reply functions
			this.replyToMessage = BdApi.findModule(m => m.toString().includes("_.S.dispatchToLastSubscribed(S.CkL.TEXTAREA_FOCUS)"));
			this.getChannel = BdApi.findModuleByProps("getChannel", "getDMFromUserId").getChannel;

			//Stores
			this.MessageStore = BdApi.findModuleByProps("receiveMessage", "editMessage");
			this.CurrentUserStore = BdApi.findModuleByProps("getCurrentUser");

			//Settings
			this.SwitchItem = BdApi.findModule(m => m.toString().includes("t=e.value,r=e.disabled"))

			//Events
			global.document.addEventListener('dblclick', this.doubleclickFunc);

			this.doubleClickToReplySetting = BdApi.loadData(config.info.id, "doubleClickToReplySetting") ?? false;
		}
		catch (err) {
			try {
				console.error("Attempting to stop after starting error...", err)
				this.stop();
			}
			catch (err) {
				console.error(this.getName() + ".stop()", err);
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
			const [state, setState] = React.useState(this.doubleClickToReplySetting);

			return React.createElement(this.SwitchItem, {
				//The state that is loaded with the default value
				value: state,
				note: "Enable to double click another's message and start replying.",
				//Since onChange passes the current state we can simply invoke it as such
				onChange: (newState) => {
					//Saving the new state
					this.doubleClickToReplySetting = newState;
					BdApi.saveData(config.info.id, "doubleClickToReplySetting", newState);
					setState(newState);
				}
				//Discord Is One Of Those
			}, "Enable Replying");
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
			if (this.copyBeforeActionModifier)
				this.copyToClipboard(document.getSelection().toString());

		//The message instance is filled top to bottom, as it is in view.
		//As a result, "baseMessage" will be the actual message you want to address. And "message" will be the reply.
		//Maybe the message has a reply, so check if "baseMessage" exists and otherwise fallback on "message".
		const message = this.getValueFromKey(instance, "baseMessage") ?? this.getValueFromKey(instance, "message");

		if (message)
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
