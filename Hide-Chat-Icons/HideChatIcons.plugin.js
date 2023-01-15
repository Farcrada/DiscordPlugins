/**
 * @name Hide Chat Icons
 * @author Farcrada
 * @version 1.3.4
 * @description Hides the chat icons behind a button.
 * 
 * @invite qH6UWCwfTu
 * @website https://github.com/Farcrada/DiscordPlugins
 * @source https://github.com/Farcrada/DiscordPlugins/blob/master/Hide-Chat-Icons/HideChatIcons.plugin.js
 * @updateUrl https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Hide-Chat-Icons/HideChatIcons.plugin.js
 */

/** @type {typeof import("react")} */
const React = BdApi.React,

	{ Webpack, Webpack: { Filters }, Data } = BdApi,

	config = {
		info: {
			name: "Hide Chat Icons",
			id: "HideChatIcons",
			description: "Hides the chat icons behind a button.",
			version: "1.3.4",
			author: "Farcrada",
			updateUrl: "https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Hide-Chat-Icons/HideChatIcons.plugin.js"
		},
		constants: {
			//Our name scheme (I should really apply the lesson I learned with unique names)
			cssStyle: "HideChatIconsStyle",
			parentID: "buttonsParent",
			buttonID: "iconButton",
			buttonHidden: "iconsHidden",
			buttonVisible: "iconsVisible",
			hideElementsName: "hideIconElement",
			forceWidth: "forceIconWidth",
			animationTime: 325
		}
	}


module.exports = class HideChatIcons {


	load() {
		try { global.ZeresPluginLibrary.PluginUpdater.checkForUpdate(config.info.name, config.info.version, config.info.updateUrl); }
		catch (err) { console.error(this.getName(), "Failed to reach the ZeresPluginLibrary for Plugin Updater.", err); }
	}

	start() {
		//We use this instead of the constructor() to make sure we only do activity when we are started.
		try {
			//Form components
			this.SwitchItem = Webpack.getModule(Filters.byStrings(
				"e.value", "e.disabled", "e.hideBorder", "e.tooltipNote",
				"e.onChange", "e.className", "e.style"
				));

			//Class variables
			this.iconsHiddenBool = Data.load(config.info.id, "hidden") ?? false;
			this.hoverBool = Data.load(config.info.id, "hover");

			//Classes
			this.buttonClasses = BdApi.findModuleByProps("buttons", "inner");
			//Class to rerender the channel area
			this.channelTextArea = BdApi.findModuleByProps("channelTextArea").channelTextArea;

			//If any CSS; clear it.
			BdApi.clearCSS(config.constants.cssStyle);
			//And add it (again)
			BdApi.injectCSS(config.constants.cssStyle, `
/* Button CSS */
#${config.constants.buttonID} {
	min-width: 12px;
	width: 12px;
	min-height: 12px;
	height: 12px;
	display: flex;
	background-position: center !important;
	background-size: 100% !important;
	opacity: 0.8;
	cursor: pointer;
}

/* How the button looks */
.theme-dark #${config.constants.buttonID}.${config.constants.buttonVisible} {
	background: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2aWV3Qm94PSIwIDAgMjQgMjQiIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+CgkJCgkJCgkJCgkJCgkJPHBhdGggZD0iTTguNTkgMTYuNTlMMTMuMTcgMTIgOC41OSA3LjQxIDEwIDZsNiA2LTYgNi0xLjQxLTEuNDF6IiBmaWxsPSIjYjliYmJlIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiLz4KCTwvc3ZnPg==) no-repeat;
}
.theme-dark #${config.constants.buttonID}.${config.constants.buttonHidden} {
	background: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2aWV3Qm94PSIwIDAgMjQgMjQiIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+CgkJCgkJCgkJCgkJCgkJPHBhdGggZD0iTTE1LjQxIDE2LjU5TDEwLjgzIDEybDQuNTgtNC41OUwxNCA2bC02IDYgNiA2IDEuNDEtMS40MXoiIGZpbGw9IiNiOWJiYmUiIGZpbGwtcnVsZT0iZXZlbm9kZCIvPgoJPC9zdmc+) no-repeat;
}
/* In light theme */
.theme-light #${config.constants.buttonID}.${config.constants.buttonVisible} {
	background: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2aWV3Qm94PSIwIDAgMjQgMjQiIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+CgkJCgkJCgkJCgkJCgkJPHBhdGggZD0iTTguNTkgMTYuNTlMMTMuMTcgMTIgOC41OSA3LjQxIDEwIDZsNiA2LTYgNi0xLjQxLTEuNDF6IiBmaWxsPSIjNGY1NjYwIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiLz4KCTwvc3ZnPg==) no-repeat;
}
.theme-light #${config.constants.buttonID}.${config.constants.buttonHidden} {
	background: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2aWV3Qm94PSIwIDAgMjQgMjQiIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+CgkJCgkJCgkJCgkJCgkJPHBhdGggZD0iTTE1LjQxIDE2LjU5TDEwLjgzIDEybDQuNTgtNC41OUwxNCA2bC02IDYgNiA2IDEuNDEtMS40MXoiIGZpbGw9IiM0ZjU2NjAiIGZpbGwtcnVsZT0iZXZlbm9kZCIvPgoJPC9zdmc+) no-repeat;
}

/* Adding this to Buttons collapses it */
.${config.constants.forceWidth} {
	width: 0px;
}
/* Attached class to buttons */
.${config.constants.hideElementsName} {
	transform: translateX(200px);
	opacity: 0;
}
/* Buttons container */
.${this.buttonClasses.buttons} {
	transition: transform ${config.constants.animationTime}ms ease, opacity ${config.constants.animationTime}ms ease;
}`);

			//Render the button and we're off to the races!
			this.renderButton(true);
		}
		catch (err) {
			try {
				console.error("Attempting to stop after initialization error...", err)
				this.stop();
			}
			catch (err) {
				console.error(config.info.name + ".stop()", err);
			}
		}
	}

	getSettingsPanel() {
		//Anonymous function to preserve the this scope,
		//which also makes it an anonymous functional component;
		//Pretty neat.
		return () => {
			const [hoverState, setHoverState] = React.useState(this.hoverBool)

			return React.createElement(this.SwitchItem, {
				//The state that is loaded with the default value
				value: hoverState,
				note: "Hover mode (turn this on to hover over the icon to expand it)",
				//Since onChange passes the current state we can simply invoke it as such
				onChange: (newState) => {
					//Saving the new state
					this.hoverBool = newState;
					Data.save(config.info.id, "hover", newState);
					setHoverState(newState);

					//Remove the hover if needed
					if (!this.hoverBool)
						this.removeHover();

					//Rerender with current settings
					this.renderButton(true);
				}
				//Discord Is One Of Those
			}, "Enable Hovering")
		};
	}

	//Store function calls for the eventListeners
	mouseclickFunc = (e) => this.toggleIcons();
	mouseenterFunc = (e) => this.toggleIcons(false, "entry");
	mouseleaveFunc = (e) => this.toggleIcons(false, "exit");

	//Everytime we switch the chat window is reloaded;
	//as a result we need to check and potentially render the button again.
	onSwitch() {
		this.renderButton();

		//And check if we need to toggle to keep it collapsed.
		this.toggleIcons(true);
	}

	//Creation and appending our button, i.e. rendering.
	renderButton(startup) {
		//This only happens when we're starting/rerendering
		let button = document.getElementById(config.constants.buttonID);
		if (button)
			if (startup)
				button.remove();
			else
				return;

		//Create our button, and fetch it's home.
		button = document.createElement('div');
		let inner = document.querySelector(`.${this.buttonClasses.inner}`),
			icons = document.querySelector(`.${this.buttonClasses.buttons}`),
			parent = document.getElementById(config.constants.parentID);

		//If there are no icons, exit
		if (!(inner && icons.firstChild))
			return;

		//Set ID for easy targeting.
		button.setAttribute('id', config.constants.buttonID);
		//Set class according to the current visibility
		button.setAttribute('class', this.iconsHiddenBool ? this.buttonHidden : this.buttonVisible);
		//Add our click event.
		button.addEventListener("click", this.mouseclickFunc);
		//Handle the hovering
		if (this.hoverBool) {
			button.addEventListener("mouseenter", this.mouseenterFunc);
			icons.addEventListener("mouseleave", this.mouseleaveFunc);
		}

		//Insert it nested, so it all looks uniform
		if (!parent) {
			parent = document.createElement('div');
			parent.setAttribute('id', config.constants.parentID);
		}

		//Check for one of my other plugins
		let deleteButton = inner.querySelector("#deleteButton");
		if (deleteButton)
			parent.insertBefore(button, deleteButton);
		else
			parent.appendChild(button);

		//And add the party to the right place
		inner.appendChild(parent);

		//Needs to be last in case our button still needs to be constructed
		if (startup)
			this.toggleIcons(true);
	}

	//Toggle McToggleson.
	toggleIcons(switched, hoverType) {
		//Get our button and icon holder
		let button = document.getElementById(config.constants.buttonID),
			icons = document.querySelector(`.${this.buttonClasses.buttons}`)

		//Mandatory null check for announcement channels.
		if (!button || !icons)
			return;

		if (switched)
			if (this.iconsHiddenBool)
				hide();
			else
				show();

		else {
			//If it is showing, we need to hide it.
			if (!this.iconsHiddenBool) {
				//Check for hover
				if (this.hoverBool)
					//Validate our hover
					if (hoverType !== "exit")
						return;

				hide();
				//Also set the memory.
				this.iconsHiddenBool = true;
			}
			//If it is hidden, we need to show it.
			else {
				//Check for hover
				if (this.hoverBool)
					//Validate our hover
					if (hoverType !== "entry")
						return;

				show();
				this.iconsHiddenBool = false;
			}

			//Hard save the change
			Data.save(config.info.id, "hidden", this.iconsHiddenBool);
		}

		function hide() {
			//Change class for CSS
			button.setAttribute('class', config.constants.buttonHidden);
			//And add our hide class to the icon holder for the animation
			icons.classList.add(config.constants.hideElementsName);

			//Make it collapse after the animation.
			setTimeout(_ => {
				icons.classList.add(config.constants.forceWidth);
			}, config.constants.animationTime);
		}

		function show() {
			icons.classList.remove(config.constants.forceWidth);
			icons.classList.remove(config.constants.hideElementsName);
			button.setAttribute('class', config.constants.buttonVisible);
		}
	}

	//Gotta remove all our patches
	stop() {
		//Our CSS
		BdApi.clearCSS(config.constants.cssStyle)

		//Fetch and save nodes
		let button = document.getElementById(config.constants.buttonID),
			icons = document.querySelector(`.${this.buttonClasses.buttons}`),
			parent = document.getElementById(config.constants.parentID);

		//Our button    
		if (button)
			button.remove();

		//Discord's buttons (dubbed: "icons") container
		if (icons) {
			//Remove any classes that we might've left
			if (icons.classList.contains(config.constants.hideElementsName))
				icons.classList.remove(config.constants.hideElementsName);

			if (icons.classList.contains(config.constants.forceWidth))
				icons.classList.remove(config.constants.forceWidth);
		}

		//If there's nothing in our parent, we can just remove it.
		if (parent && !parent.firstChild)
			parent.remove();

		this.removeHover();
	}

	//Remove the eventlisteners for hovering
	removeHover() {
		let icons = document.querySelector(`.${this.buttonClasses.buttons}`);

		//Thank you Qb and DB
		if (icons)
			icons.removeEventListener("mouseleave", this.mouseleaveFunc);
	}
}
