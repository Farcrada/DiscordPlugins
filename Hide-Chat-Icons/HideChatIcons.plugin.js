/**
 * @name HideChatIcons
 * @author Farcrada
 * @version 1.2.0
 * @description Hides the chat icons behind a button.
 * 
 * @website https://github.com/Farcrada/DiscordPlugins
 * @source https://github.com/Farcrada/DiscordPlugins/blob/master/Hide-Chat-Icons/HideChatIcons.plugin.js
 * @updateUrl https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Hide-Chat-Icons/HideChatIcons.plugin.js
 */


const config = {
    info: {
        name: "Hide Chat Icons",
        id: "HideChatIcons",
        description: "Hides the chat icons behind a button.",
        version: "1.2.0",
        author: "Farcrada",
        updateUrl: "https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Hide-Chat-Icons/HideChatIcons.plugin.js"
    }
}


class HideChatIcons {
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
            console.error(this.getName(), "Plugin Updater could not be reached.", err);
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

    getSettingsPanel() {
        return this.buildSettingChildren([{
            type: "toggle",
            label: "Hover mode (Turn this on to hover over the icon to expand it.)",
            checked: HideChatIcons.hoverBool,
            action: (event) => {
                //For some reason the "action" only gives the mouse event...
                //The toggle isn't passed, though it is handled. Unfortunate.
                let toggled;
                if (event.target.ariaChecked)
                    toggled = !(event.target.ariaChecked === "true");
                else
                    toggled = !(event.target.closest('[role=button]').ariaChecked === "true");

                //Translate the toggle and save it
                HideChatIcons.hoverBool = toggled;
                BdApi.saveData(config.info.id, "hover", HideChatIcons.hoverBool);

                //Remove the hover if needed
                if (!HideChatIcons.hoverBool)
                    this.removeHover();

                //Rerender with current settings
                this.renderButton(true);
            }
        }]);
    }

    initialize() {
        //Our name scheme (I should really apply the lesson I learned with unique names)
        HideChatIcons.cssStyle = "HideChatIconsStyle";
        HideChatIcons.parentID = "buttonsParent";
        HideChatIcons.buttonID = "iconButton";
        HideChatIcons.buttonHidden = "iconsHidden";
        HideChatIcons.buttonVisible = "iconsVisible";
        HideChatIcons.hideElementsName = "hideIconElement";
        HideChatIcons.forceWidth = "forceIconWidth"
        //Other variables
        HideChatIcons.iconsHiddenBool = BdApi.loadData(config.info.id, "hidden");
        HideChatIcons.hoverBool = BdApi.loadData(config.info.id, "hover");
        HideChatIcons.animationTime = 325;

        //Main controls used to construct the settings panel
        HideChatIcons.MenuControls = BdApi.findModuleByProps("RadioItem", "Item");

        //Classes
        HideChatIcons.buttonClasses = BdApi.findModuleByProps("buttons");

        //Class to rerender the channel area
        HideChatIcons.channelTextArea = BdApi.findModuleByProps("channelTextArea").channelTextArea;

        //If any CSS; clear it.
        BdApi.clearCSS(HideChatIcons.cssStyle);
        //And add it (again)
        BdApi.injectCSS(HideChatIcons.cssStyle, `
        /* Button CSS */
        #${HideChatIcons.buttonID} {
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
        .theme-dark #${HideChatIcons.buttonID}.${HideChatIcons.buttonVisible} {
            background: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2aWV3Qm94PSIwIDAgMjQgMjQiIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+CgkJCgkJCgkJCgkJCgkJPHBhdGggZD0iTTguNTkgMTYuNTlMMTMuMTcgMTIgOC41OSA3LjQxIDEwIDZsNiA2LTYgNi0xLjQxLTEuNDF6IiBmaWxsPSIjYjliYmJlIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiLz4KCTwvc3ZnPg==) no-repeat;
        }
        .theme-dark #${HideChatIcons.buttonID}.${HideChatIcons.buttonHidden} {
            background: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2aWV3Qm94PSIwIDAgMjQgMjQiIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+CgkJCgkJCgkJCgkJCgkJPHBhdGggZD0iTTE1LjQxIDE2LjU5TDEwLjgzIDEybDQuNTgtNC41OUwxNCA2bC02IDYgNiA2IDEuNDEtMS40MXoiIGZpbGw9IiNiOWJiYmUiIGZpbGwtcnVsZT0iZXZlbm9kZCIvPgoJPC9zdmc+) no-repeat;
        }
        /* In light theme */
        .theme-light #${HideChatIcons.buttonID}.${HideChatIcons.buttonVisible} {
            background: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2aWV3Qm94PSIwIDAgMjQgMjQiIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+CgkJCgkJCgkJCgkJCgkJPHBhdGggZD0iTTguNTkgMTYuNTlMMTMuMTcgMTIgOC41OSA3LjQxIDEwIDZsNiA2LTYgNi0xLjQxLTEuNDF6IiBmaWxsPSIjNGY1NjYwIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiLz4KCTwvc3ZnPg==) no-repeat;
        }
        .theme-light #${HideChatIcons.buttonID}.${HideChatIcons.buttonHidden} {
            background: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2aWV3Qm94PSIwIDAgMjQgMjQiIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+CgkJCgkJCgkJCgkJCgkJPHBhdGggZD0iTTE1LjQxIDE2LjU5TDEwLjgzIDEybDQuNTgtNC41OUwxNCA2bC02IDYgNiA2IDEuNDEtMS40MXoiIGZpbGw9IiM0ZjU2NjAiIGZpbGwtcnVsZT0iZXZlbm9kZCIvPgoJPC9zdmc+) no-repeat;
        }

        /* Adding this to Buttons collapses it */
        .${HideChatIcons.forceWidth} {
            width: 0px;
        }
        /* Attached class to buttons */
        .${HideChatIcons.hideElementsName} {
            transform: translateX(200px);
            opacity: 0;
        }
        /* Buttons container */
        .${HideChatIcons.buttonClasses.buttons} {
            transition: transform ${HideChatIcons.animationTime}ms ease, opacity ${HideChatIcons.animationTime}ms ease;
        }`)

        //Render the button and we're off to the races!
        this.renderButton(true);
    }

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
        if (startup) {
            //As a precaution, we're going to remove the button
            let button = document.getElementById(HideChatIcons.buttonID)
            if (button)
                button.remove();
        }

        //Create our button, and fetch it's home.
        let button = document.createElement('div'),
            inner = document.querySelector(`.${HideChatIcons.buttonClasses.inner}`),
            icons = document.querySelector(`.${HideChatIcons.buttonClasses.buttons}`),
            parent = document.getElementById(HideChatIcons.parentID);

        //If there are no icons, exit
        if (!(inner && icons.firstChild))
            return;

        //Set ID for easy targeting.
        button.setAttribute('id', HideChatIcons.buttonID);
        //Set class according to the current visibility
        button.setAttribute('class', HideChatIcons.iconsHiddenBool ? HideChatIcons.buttonHidden : HideChatIcons.buttonVisible);
        //Add our click event.
        button.addEventListener("click", (e) => this.toggleIcons());
        //Handle the hovering
        if (HideChatIcons.hoverBool) {
            button.addEventListener("mouseenter", (e) => this.toggleIcons(false, "entry"));
            icons.addEventListener("mouseleave", (e) => this.toggleIcons(false, "exit"));
        }


        //Insert it nested, so it all looks uniform
        if (!parent) {
            parent = document.createElement('div');
            parent.setAttribute('id', HideChatIcons.parentID);
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
        let button = document.getElementById(HideChatIcons.buttonID),
            icons = document.querySelector(`.${HideChatIcons.buttonClasses.buttons}`)

        //Mandatory null check for announcement channels.
        if (!button || !icons)
            return;

        if (switched)
            if (HideChatIcons.iconsHiddenBool)
                hide();
            else
                show();

        else {
            //If it is showing, we need to hide it.
            if (!HideChatIcons.iconsHiddenBool) {
                //Check for hover
                if (HideChatIcons.hoverBool)
                    //Validate our hover
                    if (hoverType !== "exit")
                        return;

                hide();
                //Also set the memory.
                HideChatIcons.iconsHiddenBool = true;
            }
            //If it is hidden, we need to show it.
            else {
                //Check for hover
                if (HideChatIcons.hoverBool)
                    //Validate our hover
                    if (hoverType !== "entry")
                        return;

                show();
                HideChatIcons.iconsHiddenBool = false;
            }

            //Hard save the change
            BdApi.saveData(config.info.id, "hidden", HideChatIcons.iconsHiddenBool);
        }

        function hide() {
            //Change class for CSS
            button.setAttribute('class', HideChatIcons.buttonHidden);
            //And add our hide class to the icon holder for the animation
            icons.classList.add(HideChatIcons.hideElementsName);

            //Make it collapse after the animation.
            setTimeout(_ => {
                icons.classList.add(HideChatIcons.forceWidth);
            }, HideChatIcons.animationTime);
        }

        function show() {
            icons.classList.remove(HideChatIcons.forceWidth);
            icons.classList.remove(HideChatIcons.hideElementsName);
            button.setAttribute('class', HideChatIcons.buttonVisible);
        }
    }

    //Gotta remove all our patches
    stop() {
        //Our CSS
        BdApi.clearCSS(HideChatIcons.cssStyle)

        //Fetch and save nodes
        let button = document.getElementById(HideChatIcons.buttonID),
            icons = document.querySelector(`.${HideChatIcons.buttonClasses.buttons}`),
            parent = document.getElementById(HideChatIcons.parentID);

        //Our button    
        if (button)
            button.remove();

        //Discord's buttons (dubbed: "icons") container
        if (icons) {
            //Remove any classes that we might've left
            if (icons.classList.contains(HideChatIcons.hideElementsName))
                icons.classList.remove(HideChatIcons.hideElementsName);

            if (icons.classList.contains(HideChatIcons.forceWidth))
                icons.classList.remove(HideChatIcons.forceWidth);
        }

        //If there's nothing in our parent, we can just remove it.
        if (parent && !parent.firstChild)
            parent.remove();

        this.removeHover();
    }

    //Remove the eventlisteners for hovering
    removeHover() {
        let icons = document.querySelector(`.${HideChatIcons.buttonClasses.buttons}`);

        //TODO: Neither of these want to work. I'm over it; it more or less works.
        if (icons)
            icons.removeEventListener("mouseleave", (e) => this.toggleIcons(false, "exit"));

        //Rerender to remove stubborn listener.
        BdApi.getInternalInstance(document.querySelector(`.${HideChatIcons.channelTextArea}`)).return.return.return.return.stateNode.forceUpdate();
    }

    buildSettingItem(props) {
        let { type } = props;

        let Component;
        switch (type) {
            case "separator":
                return BdApi.React.createElement(HideChatIcons.MenuControls.Separator);
            case "toggle":
                Component = HideChatIcons.MenuControls.CheckboxItem;
                break;
            default:
                Component = HideChatIcons.MenuControls.Item
                break;
        }
        props.extended = true;
        return BdApi.React.createElement(Component, props);
    }

    buildSettingChildren(setup) {
        let mapper = s => {
            return this.buildSettingItem(s);
        };
        return setup.map(mapper).filter(i => i);
    }
}
