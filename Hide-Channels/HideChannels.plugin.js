/**
 * @name HideChannels
 * @author Farcrada
 * @version 1.0.1
 * @description Hide channel list from view.
 * 
 * @website https://github.com/Farcrada/DiscordPlugins
 * @source https://github.com/Farcrada/DiscordPlugins/edit/master/Hide-Channels/HideChannels.plugin.js
 * @updateUrl https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Hide-Channels/HideChannels.plugin.js
 */


class HideChannels {
    getName() { return "Hide Channels"; }
    getDescription() { return "Hide channel list from view."; }
    getVersion() { return "1.0.1"; }
    getAuthor() { return "Farcrada"; }

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
            global.ZeresPluginLibrary.PluginUpdater.checkForUpdate(this.getName(), this.getVersion(), "https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Hide-Channels/HideChannels.plugin.js");
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
                console.error("Attempting to stop after initialization error...")
                this.stop();
            }
            catch (err) {
                console.error(this.getName() + ".stop()", err);
            }
        }
    }

    //Everytime we switch the chat window is reloaded;
    //as a result we need to check and potentially render the button again.
    onSwitch() {
        if (!document.getElementById(HideChannels.buttonID))
            this.renderButton();
    }

    initialize() {
        //The sidebar to "minimize"/hide
        HideChannels.sidebarClass = BdApi.findModuleByProps("container", "base").sidebar;
        //The header to place the button into.
        HideChannels.channelHeaderClass = BdApi.findModuleByProps("chat", "title").title;

        //The names we need for CSS
        HideChannels.hideElementsName = 'hideElement';
        HideChannels.buttonID = 'toggleChannels';
        HideChannels.buttonHidden = 'channelsHidden';
        HideChannels.buttonVisible = 'channelsVisible';

        //Need to make sure we can track the position.
        HideChannels.channelsHiddenBool = false;

        //Check if there is any CSS we have already, and remove it.
        let HideChannelsStyle = document.getElementById("HideChannelsStyle");
        if (HideChannelsStyle)
            HideChannelsStyle.parentElement.removeChild(HideChannelsStyle);

        //Now inject our (new) CSS
        BdApi.injectCSS("HideChannelsStyle", `
        /* Button CSS */
        #toggleChannels {
            min-width: 24px;
            height: 24px;
            background-position: center !important;
            background-size: 100% !important;
            opacity: 0.8;
            cursor: pointer;
        }
        
        /* How the button looks */
        .theme-dark #toggleChannels.channelsVisible {
            background: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2ZmZiIgd2lkdGg9IjE4cHgiIGhlaWdodD0iMThweCI+PHBhdGggZD0iTTE4LjQxIDE2LjU5TDEzLjgyIDEybDQuNTktNC41OUwxNyA2bC02IDYgNiA2ek02IDZoMnYxMkg2eiIvPjxwYXRoIGQ9Ik0yNCAyNEgwVjBoMjR2MjR6IiBmaWxsPSJub25lIi8+PC9zdmc+) no-repeat;
        }
        .theme-dark #toggleChannels.channelsHidden {
            background: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2ZmZiIgd2lkdGg9IjE4cHgiIGhlaWdodD0iMThweCI+PHBhdGggZD0iTTAgMGgyNHYyNEgwVjB6IiBmaWxsPSJub25lIi8+PHBhdGggZD0iTTUuNTkgNy40MUwxMC4xOCAxMmwtNC41OSA0LjU5TDcgMThsNi02LTYtNnpNMTYgNmgydjEyaC0yeiIvPjwvc3ZnPg==) no-repeat;
        }
        /* In light theme */
        .theme-light #toggleChannels.channelsVisible {
            background: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzRmNTY2MCIgd2lkdGg9IjE4cHgiIGhlaWdodD0iMThweCI+PHBhdGggZD0iTTE4LjQxIDE2LjU5TDEzLjgyIDEybDQuNTktNC41OUwxNyA2bC02IDYgNiA2ek02IDZoMnYxMkg2eiIvPjxwYXRoIGQ9Ik0yNCAyNEgwVjBoMjR2MjR6IiBmaWxsPSJub25lIi8+PC9zdmc+) no-repeat;
        }
        .theme-light #toggleChannels.channelsHidden {
            background: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzRmNTY2MCIgd2lkdGg9IjE4cHgiIGhlaWdodD0iMThweCI+PHBhdGggZD0iTTAgMGgyNHYyNEgwVjB6IiBmaWxsPSJub25lIi8+PHBhdGggZD0iTTUuNTkgNy40MUwxMC4xOCAxMmwtNC41OSA0LjU5TDcgMThsNi02LTYtNnpNMTYgNmgydjEyaC0yeiIvPjwvc3ZnPg==) no-repeat;
        }
        
        /* Attached CSS to sidebar */
        .hideElement {
            width: 0 !important;
        }
        
        /* Set animations */
        .${HideChannels.sidebarClass} {
            transition: width 400ms ease;
        }
        /* Animations with element */
        .${HideChannels.sidebarClass}.hideElement {
            transition: width 400ms ease;
        }`);
        //Render the button and we're off to the races!
        this.renderButton();
    }

    //Creation and appending our button, i.e. rendering.
    renderButton() {
        //Create our button, and fetch it's home.
        let button = document.createElement('div'),
            titleBar = document.querySelector(`.${HideChannels.channelHeaderClass}`);

        //If there is no title bar, dump
        if (!titleBar)
            return;
        
        //Set ID for easy targeting.
        button.setAttribute('id', HideChannels.buttonID);
        //Set class according to the current visibility
        button.setAttribute('class', HideChannels.channelsHiddenBool ? HideChannels.buttonHidden : HideChannels.buttonVisible);
        //Add our click event.
        button.addEventListener('click', () => this.toggleChannels());

        //Insert it nested, so it all looks uniform
        titleBar.firstChild.insertBefore(button, titleBar.firstChild.firstChild);

    }

    //Toggle McToggleson.
    toggleChannels() {
        //Get the button and sidebar
        let button = document.getElementById(HideChannels.buttonID),
            sidebar = document.querySelector(`.${HideChannels.sidebarClass}`)

        //If it is showing, we need to hide it.
        if (!HideChannels.channelsHiddenBool) {
            //Change class for CSS
            button.setAttribute('class', HideChannels.buttonHidden);
            //And add it to sidebar for the animation
            sidebar.classList.add(HideChannels.hideElementsName);
            //Also set the memory.
            HideChannels.channelsHiddenBool = true;
        }
        //If it is hidden, we need to show it.
        else {
            button.setAttribute('class', HideChannels.buttonVisible);
            sidebar.classList.remove(HideChannels.hideElementsName);

            HideChannels.channelsHiddenBool = false;
        }
    }

    //Remove and cleanup
    stop() {
        //Our CSS
        let HideChannelsStyle = document.getElementById("HideChannelsStyle");
        if (HideChannelsStyle)
            HideChannelsStyle.parentElement.removeChild(HideChannelsStyle);

        //Our button
        let button = document.getElementById(HideChannels.buttonID);
        if (button)
            button.remove();

        //And if there are remnants of css left,
        //make sure we remove the class from the sidebar to ensure visual confirmation.
        let sidebar = document.querySelector(`.${HideChannels.sidebarClass}`);
        if (sidebar.classList.contains(HideChannels.hideElementsName))
            sidebar.classList.remove(HideChannels.hideElementsName);
    }
}
