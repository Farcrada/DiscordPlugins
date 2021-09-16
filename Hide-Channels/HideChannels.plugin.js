/**
 * @name HideChannels
 * @author Farcrada
 * @version 2.0.1
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
		version: "2.0.1",
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
	getDescription() { return config.info.description; }
	getVersion() { return config.info.version; }
	getAuthor() { return config.info.author; }

	start() {
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

		//Now try to initialize.
		try {
			this.initialize();
		}
		catch (err) {
			try {
				console.error("Attempting to stop after initialization error...", err)
				this.stop();
			}
			catch (err) {
				console.error(this.getName() + ".stop()", err);
			}
		}
	}

	initialize() {
		//The sidebar to "minimize"/hide
		this.sidebarClass = BdApi.findModuleByProps("container", "base").sidebar;

		//And the keybind
		this.keybindSetting = this.checkKeybindLoad(BdApi.loadData(config.info.id, "keybind"));
		this.keybind = this.setKeybind(this.keybindSetting);
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

	patchTitleBar() {
		//The header bar above the "chat"
		const HeaderBar = BdApi.findModule(m => m?.default?.displayName === "HeaderBar");

		BdApi.Patcher.before(config.info.id, HeaderBar, "default", (thisObject, methodArguments, returnValue) => {
			methodArguments[0].children.unshift(BdApi.React.createElement(this.hideChannelComponent));
		});
	}

	//Functional component to listen; compact, reusable, clean
	useListener = (event, callback, bubbling, target = document) => {
		BdApi.React.useEffect(() => {
			//ComponentDidMount
			target.addEventListener(event, callback, bubbling);
			//ComponentWillUnmount
			return () => target.removeEventListener(event, callback, bubbling);
		});
	}

	//
	hideChannelComponent = () => {
		//When a state updates, it rerenders.
		const [hidden, setHidden] = BdApi.React.useState(false);

		//Keydown event
		this.useListener("keydown", e => {
			//Since we made this an object,
			//we can make new propertire with `[]`
			this.currentlyPressed[e.keyCode] = true;
		}, true, window);

		//Keyup event
		this.useListener("keyup", e => {
			//Check if every currentlyPessed is in our saved keybind.
			if (this.keybind.every(key => this.currentlyPressed[key] === true))
				//Rerender on toggle; change the state.
				setHidden(this.toggleChannels.bind(this));

			//Current key goes up, so...
			this.currentlyPressed[e.keyCode] = false;
		}, true, window);

		return BdApi.React.createElement("div", {
			//Styling
			id: config.constants.buttonID,
			//To identify our object
			key: config.info.id,
			//The icon
			className: hidden ? config.constants.buttonHidden : config.constants.buttonVisible,
			//Rerender on toggle; change the state.
			onClick: () => setHidden(this.toggleChannels.bind(this))
		});
	}

	//Settings
	getSettingsPanel() {
		return BdApi.React.createElement(this.FormItem, {
			title: "Toggle by keybind:"
		},
			BdApi.React.createElement(this.KeybindRecorder, {
				defaultValue: this.keybindSetting,
				onChange: (e) => {
					this.keybind = this.setKeybind(e);
					BdApi.saveData(config.info.id, "keybind", e);
				}
			}));
	}

	//Remove and cleanup
	stop() {
		BdApi.Patcher.unpatchAll(config.info.id);

		//Our CSS
		BdApi.clearCSS(config.constants.cssStyle);

		//And if there are remnants of css left,
		//make sure we remove the class from the sidebar to ensure visual confirmation.
		let sidebar = document.querySelector(`.${this.sidebarClass}`);
		if (sidebar.classList.contains(config.constants.hideElementsName))
			sidebar.classList.remove(config.constants.hideElementsName);
	}

	//Toggle McToggleson.
	toggleChannels(state) {
		//Get the button and sidebar
		let sidebar = document.querySelector(`.${this.sidebarClass}`)

		//If it is showing, we need to hide it.
		if (!state)
			//Add class for CSS
			sidebar.classList.add(config.constants.hideElementsName);

		//If it is hidden, we need to show it.
		else
			sidebar.classList.remove(config.constants.hideElementsName);

		return !state;
	}

	//These could be statics, but looks scuffed.
	//Nullchecking, basically
	checkKeybindLoad(keybindSetting) {
		if (!keybindSetting)
			return [[0, 162], [0, 72]];
		for (const keybind of keybindSetting) {
			if (Array.isArray(keybind)) {
				for (const key of keybind)
					if (typeof (key) !== "number")
						return [[0, 162], [0, 72]];
			}
			else if (typeof (keybind) !== "number")
				return [[0, 162], [0, 72]];

		}
		return keybindSetting;
	}

	//Filter that shit
	setKeybind(keybind) {
		//We need to filter the tab, ctrl, alt and shift keys because it's scuffed.
		//Lets fix it.
		return keybind.map(keyCode => {
			if (Array.isArray(keyCode[0]))
				for (let i = 0; i < keyCode.length; i++)
					keyCode[i] = fixCode(keyCode[i])
			else
				keyCode = fixCode(keyCode);
			return keyCode;

			function fixCode(code) {
				//code[0] is always 0, lets make this simpel for us.
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
					default: return code;       //Other keys? return;
				}
			}
		});
	}
}
