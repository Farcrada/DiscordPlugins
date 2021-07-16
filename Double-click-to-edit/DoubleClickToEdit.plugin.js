/**
 * @name DoubleClickToEdit
 * @author Farcrada
 * @version 9.2.0
 * @description Double click a message you wrote to quickly edit it.
 * 
 * @website https://github.com/Farcrada/DiscordPlugins/
 * @source https://github.com/Farcrada/DiscordPlugins/blob/master/Double-click-to-edit/DoubleClickToEdit.plugin.js
 * @updateUrl https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Auto-Scale-Text-Area-Icons/AutoScaleTextAreaIcons.plugin.js
 */


const config = {
    info: {
        name: "Double Click To Edit",
        id: "DoubleClickToEdit",
        description: "Double click a message you wrote to quickly edit it",
        version: "9.2.0",
        author: "Farcrada",
        updateUrl: "https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Auto-Scale-Text-Area-Icons/AutoScaleTextAreaIcons.plugin.js"
    }
}


class DoubleClickToEdit {
    getName() { return config.info.name; }
    getDescription() { return config.info.description; }
    getVersion() { return config.info.version; }
    getAuthor() { return `${config.info.author}, original idea by Jiiks`; }

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

    initialize() {
        //Classes
        this.selectedClass = BdApi.findModuleByProps("message", "selected").selected;

        //Stores
        this.MessageStore = BdApi.findModuleByProps("receiveMessage", "editMessage");
        this.CurrentUserStore = BdApi.findModuleByProps("getCurrentUser");

        //This we can do because the only way this fails is
        //if the entire instance is refreshed
        document.addEventListener('dblclick', this.doubleclickFunc);
    }

    doubleclickFunc = (e) => this.handler(e);

    //Though we oughtta remove it when stopping
    stop() { document.removeEventListener('dblclick', this.doubleclickFunc); }

    handler(e) {
        //Target the message
        let messagediv = e.target.closest('[class^=message]');
        //If it finds nothing, null it.
        if (!messagediv)
            return;

        //Make sure we're not resetting when the message is already in edit-mode.
        if (messagediv.classList.contains(this.selectedClass))
            return;

        //Basically make a HTMLElement/Node interactable with it's React components.
        let instance = BdApi.getInternalInstance(messagediv);
        //Mandatory nullcheck
        if (!instance)
            return;

        //This is filled with the message top to bottom,
        //if it has a quote the quote will be "message".
        let message = this.getValueFromKey(instance, "message");
        //As a result, this will be the actual message you want to edit.
        let baseMessage = this.getValueFromKey(instance, "baseMessage");

        //Check if the quote or standalone message is yours.
        let msgYours = this.messageYours(message, this.CurrentUserStore.getCurrentUser().id);
        //If double clicked a message with a quote, check if the "base"-message is yours.
        let baseMsgYours = this.messageYours(baseMessage, this.CurrentUserStore.getCurrentUser().id);

        //Message(/quote) isn't yours
        if (!msgYours) {
            message = baseMessage;
            //Maybe the base message is yours
            if (!baseMsgYours)
                return
        }
        //Message(/quote) is yours
        else if (msgYours) {
            //Maybe it is a quote, so check the base message (if it exists)
            if (baseMsgYours)
                message = baseMessage;
            //This can also be "undefined", so a simple !baseMsgYours is not gonna work.
            else if (baseMsgYours == false)
                return;
        }

        //If anything was yours;
        //Execute order 66
        this.MessageStore.startEditMessage(message.channel_id, message.id, message.content);
    }

    messageYours(message, id) {
        //If message is falsely
        if (!message)
            return undefined;

        //If it's us
        if (message.author.id === id)
            return true;
        //But if it's not!
        return false;
    }

    getValueFromKey(instance, searchkey) {
        //Where we want to search.
        let whitelist = {
            memoizedProps: true,
            child: true,
            sibling: true
        };
        //Start our mayhem
        return getKey(instance)

        function getKey(instance) {
            //Pre-define
            let result = undefined;
            //Make sure it exists and isn't a "paradox".
            if (instance && !Node.prototype.isPrototypeOf(instance)) {
                //Get our own keys
                let keys = Object.getOwnPropertyNames(instance);
                //As long as we don't have a result, lets go through.
                for (let i = 0; result === undefined && i < keys.length; i++) {
                    //Store our key for readability
                    let key = keys[i];
                    //Check if there is a key
                    if (key) {
                        //Store the value
                        let value = instance[key];
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
        }
    }
}
