/**
 * @name HideChannels
 * @author Farcrada
 * @version 2.1.0
 * @description Hide channel list from view.
 * 
 * @website https://github.com/Farcrada/DiscordPlugins
 * @source https://github.com/Farcrada/DiscordPlugins/edit/master/Hide-Channels/HideChannels.plugin.js
 * @updateUrl https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Hide-Channels/HideChannels.plugin.js
 */


const config = {
	info: {
		name: "Hide Channels",
		id: "HideChannels",
		description: "Hide channel list from view.",
		version: "2.1.0",
		author: "Farcrada",
		updateUrl: "https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Hide-Channels/HideChannels.plugin.js"
	},
	constants: {
		//The names we need for CSS
		cssStyle: "HideChannelsStyle",
		hideElementsName: "hideChannelElement",
		buttonID: "toggleChannels",
		buttonHidden: "channelsHidden",
		buttonVisible: "channelsVisible"
	}
}


class HideChannels {

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
			}
			catch (err) {
				console.error(this.getName(), "Failed to enable ZeresPluginLibrary for Plugin Updater.", err);

			}
		}
	}

	start() {
		try {
			//The sidebar to "minimize"/hide
			this.sidebarClass = BdApi.findModuleByProps("container", "base").sidebar;

			//And the keybind
			this.keybindSetting = this.checkKeybindLoad(BdApi.loadData(config.info.id, "keybind"));
			this.keybind = this.filterKeybind(this.keybindSetting);
			//Predefine current keybind
			this.currentlyPressed = {};

			//React components for settings
			this.FormItem = BdApi.findModuleByProps("FormItem").FormItem;
			this.KeybindRecorder = BdApi.findModuleByDisplayName("KeybindRecorder");

			//Check if there is any CSS we have already, and remove it.
			BdApi.clearCSS(config.constants.cssStyle);

			//Now inject our (new) CSS
			BdApi.injectCSS(config.constants.cssStyle, `
/* Button CSS */
#${config.constants.buttonID} {
    min-width: 24px;
    height: 24px;
    background-position: center !important;
    background-size: 100% !important;
    opacity: 0.8;
    cursor: pointer;
}

/* How the button looks */
.theme-dark #${config.constants.buttonID}.${config.constants.buttonVisible} {
    background: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2ZmZiIgd2lkdGg9IjE4cHgiIGhlaWdodD0iMThweCI+PHBhdGggZD0iTTE4LjQxIDE2LjU5TDEzLjgyIDEybDQuNTktNC41OUwxNyA2bC02IDYgNiA2ek02IDZoMnYxMkg2eiIvPjxwYXRoIGQ9Ik0yNCAyNEgwVjBoMjR2MjR6IiBmaWxsPSJub25lIi8+PC9zdmc+) no-repeat;
}
.theme-dark #${config.constants.buttonID}.${config.constants.buttonHidden} {
    background: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2ZmZiIgd2lkdGg9IjE4cHgiIGhlaWdodD0iMThweCI+PHBhdGggZD0iTTAgMGgyNHYyNEgwVjB6IiBmaWxsPSJub25lIi8+PHBhdGggZD0iTTUuNTkgNy40MUwxMC4xOCAxMmwtNC41OSA0LjU5TDcgMThsNi02LTYtNnpNMTYgNmgydjEyaC0yeiIvPjwvc3ZnPg==) no-repeat;
}
/* In light theme */
.theme-light #${config.constants.buttonID}.${config.constants.buttonVisible} {
    background: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzRmNTY2MCIgd2lkdGg9IjE4cHgiIGhlaWdodD0iMThweCI+PHBhdGggZD0iTTE4LjQxIDE2LjU5TDEzLjgyIDEybDQuNTktNC41OUwxNyA2bC02IDYgNiA2ek02IDZoMnYxMkg2eiIvPjxwYXRoIGQ9Ik0yNCAyNEgwVjBoMjR2MjR6IiBmaWxsPSJub25lIi8+PC9zdmc+) no-repeat;
}
.theme-light #${config.constants.buttonID}.${config.constants.buttonHidden} {
    background: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzRmNTY2MCIgd2lkdGg9IjE4cHgiIGhlaWdodD0iMThweCI+PHBhdGggZD0iTTAgMGgyNHYyNEgwVjB6IiBmaWxsPSJub25lIi8+PHBhdGggZD0iTTUuNTkgNy40MUwxMC4xOCAxMmwtNC41OSA0LjU5TDcgMThsNi02LTYtNnpNMTYgNmgydjEyaC0yeiIvPjwvc3ZnPg==) no-repeat;
}

/* Attached CSS to sidebar */
.${config.constants.hideElementsName} {
    width: 0 !important;
}

/* Set animations */
.${this.sidebarClass} {
    transition: width 400ms ease;
}`);

			//Render the button and we're off to the races!
			this.patchTitleBar();
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

	getSettingsPanel() {
		//Return our keybind settings wrapped in a form item
		return BdApi.React.createElement(this.FormItem, {
			title: "Toggle by keybind:"
		},
			//Containing a keybind recorder.
			BdApi.React.createElement(this.KeybindRecorder, {
				defaultValue: this.keybindSetting,
				onChange: (e) => {
					//Set the keybind and save it.
					this.keybind = this.filterKeybind(e);
					BdApi.saveData(config.info.id, "keybind", e);
					//And the keybindSetting
					this.keybindSetting = this.checkKeybindLoad(e);
				}
			}));
	}

	stop() {
		BdApi.Patcher.unpatchAll(config.info.id);

		//Our CSS
		BdApi.clearCSS(config.constants.cssStyle);

		//And if there are remnants of css left,
		//make sure we remove the class from the sidebar to ensure visual confirmation.
		let sidebar = document.querySelector(`.${this.sidebarClass}`);
		if (sidebar?.classList.contains(config.constants.hideElementsName))
			sidebar.classList.remove(config.constants.hideElementsName);
	}

	patchTitleBar() {
		//The header bar above the "chat"; this is the same for the `Split View`.
		const HeaderBar = BdApi.findModule(m => m?.default?.displayName === "HeaderBar");

		BdApi.Patcher.before(config.info.id, HeaderBar, "default", (thisObject, methodArguments, returnValue) => {
			//When elements are being re-rendered we need to check if there actually is a place for us.
			//Along with that we need to check if what we're adding to is an array;
			//because if not we'll render a button on the split view.

			//Also: Prevent thread button appearing with this first line.
			if (methodArguments[0]?.["aria-label"])
				if (Array.isArray(methodArguments[0]?.children))
					//Make sure our component isn't already present.
					if (methodArguments[0].children[0]?.key !== config.info.id)
						//And since we want to be on the most left of the header bar for style we unshift into the array.
						methodArguments[0].children.unshift(BdApi.React.createElement(this.hideChannelComponent, { key: config.info.id }));

		});
	}

	/**
	 * React component for our button.
	 * @returns React element
	 */
	hideChannelComponent = () => {
		//Only fetch the sidebar on a rerender.
		const sidebarNode = document.querySelector(`.${this.sidebarClass}`),
			//When a state updates, it rerenders.
			[hidden, setHidden] = BdApi.React.useState(
				//Check on a rerender where our side bar is so we can correctly reflect this.
				sidebarNode?.classList.contains(config.constants.hideElementsName) ?
					true : false);

		/**
		 * Use this to make a despensable easy to use listener with React.
		 * @param {string} eventName The name of the event to listen for.
		 * @param {callback} callback Function to call when said event is triggered.
		 * @param {boolean} bubbling Handle bubbling or not
		 * @param {object} [target] The object to attach our listener to.
		 */
		function useListener(eventName, callback, bubbling, target = document) {
			BdApi.React.useEffect(() => {
				//ComponentDidMount
				target.addEventListener(eventName, callback, bubbling);
				//ComponentWillUnmount
				return () => target.removeEventListener(eventName, callback, bubbling);
			});
		}

		/**
		 * Adds and removes our CSS to make our sidebar appear and disappear.
		 * @param {Node} sidebar Sidebar node we want to toggle.
		 * @returns The passed state in reverse.
		 */
		function toggleSidebar(sidebar) {

			/**
			 * @param {boolean} state State that determines the toggle.
			 */
			return state => {
				//If it is showing, we need to hide it.
				if (!state)
					//We hide it through CSS by adding a class.
					sidebar?.classList.add(config.constants.hideElementsName);
				//If it is hidden, we need to show it.
				else
					sidebar?.classList.remove(config.constants.hideElementsName);
				return !state;
			};
		}

		//Keydown event
		useListener("keydown", e => {
                        //Only toggle when the ctrl key is press (i.e. ctrl+h)
                        if (!e.ctrlKey) return;
			//Since we made this an object,
			//we can make new propertire with `[]`
			this.currentlyPressed[e.keyCode] = true;

			//Account for bubbling and attach to the global: `window`
		}, true, window);

		//Keyup event
		useListener("keyup", e => {
			//Check if every currentlyPessed is in our saved keybind.
			if (this.keybind.every(key => this.currentlyPressed[key] === true))
				//Toggle the sidebar and rerender on toggle; change the state
				setHidden(toggleSidebar(sidebarNode));

			//Current key goes up, so...
			this.currentlyPressed[e.keyCode] = false;

			//Account for bubbling and attach to the global: `window`
		}, true, window);

		//Return our element.
		return BdApi.React.createElement("div", {
			//Styling
			id: config.constants.buttonID,
			//To identify our object
			key: "hideChannelComponent",
			//The icon
			className: hidden ? config.constants.buttonHidden : config.constants.buttonVisible,
			//Toggle the sidebar and rerender on toggle; change the state.
			onClick: () => setHidden(toggleSidebar(sidebarNode))
		});
	}

	/**
	 * Checks the given keybind for validity. If not valid returns a default keybind.
	 * @param {Array.<Array.<number>>} keybindToLoad The keybind to filter and load in.
	 * @param {!Array.<Array.<number>>} [defaultKeybind] A default keybind to fall back on in case of invalidity.
	 * @returns Will return the keybind or return a default keybind.
	 */
	checkKeybindLoad(keybindToLoad, defaultKeybind = [[0, 162], [0, 72]]) {
		if (!keybindToLoad)
			return defaultKeybind;
		for (const key of keybindToLoad) {
			if (Array.isArray(key)) {
				for (const keyCode of key)
					if (typeof (keyCode) !== "number")
						return defaultKeybind;
			}
			else if (typeof (key) !== "number")
				return defaultKeybind;

		}
		return keybindToLoad;
	}

	/**
	 * Filters a keybind to work with the `EventListener`s.
	 * @param {(Array.<number>|Array.<Array.<number>>)} keybind Keybind to filter.
	 * @returns {(Array.<number>|Array.<Array.<number>>)} The filtered keybind.
	 */
	filterKeybind(keybind) {
		return keybind.map(keyCode => {
			//Multiple keys
			if (Array.isArray(keyCode[0]))
				for (let i = 0; i < keyCode.length; i++)
					keyCode[i] = fixCode(keyCode[i])
			//Single keys
			else
				keyCode = fixCode(keyCode);
			//Return our fixed keycode.
			return keyCode;

			function fixCode(code) {
				code = code[1];
				switch (code) {
					case 20:                    //Tab: 20 -> 9
						return 9;
					//Fallthrough since it's the same
					case 160:                   //Shift: 160 -> 16 
					case 161:                   //R Shift: 161 -> 16
						return 16;
					//Again
					case 162:                   //Control: 162 -> 17
					case 163:                   //R Control: 163 -> 17
						return 17;
					//And again.
					case 164:                   //Alt: 164 -> 18
					case 165:                   //R Alt: 165 ->  18
						return 18;
					default: return code;       //Other keys? return them;
				}
			}
		});
	}
}
