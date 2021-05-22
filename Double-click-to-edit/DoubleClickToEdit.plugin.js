/**
 * @name DoubleClickToEdit
 * 
 * @website https://github.com/Farcrada/DiscordPlugins/
 * @source https://github.com/Farcrada/DiscordPlugins/blob/master/Double-click-to-edit/DoubleClickToEdit.plugin.js
 */


class DoubleClickToEdit {
    getName() { return "Double click to edit"; }
    getDescription() { return "Double click messages to edit them."; }
    getVersion() { return "9.1.3"; }
    getAuthor() { return "Farcrada, original by Jiiks"; }

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

        try {
            if (global.ZeresPluginLibrary) this.initialize();
        }
        catch (err) {
            console.error(this.getName(), "fatal error, plugin could not be started!", err);

            try {
                this.stop();
            }
            catch (err) {
                console.error(this.getName() + ".stop()", err);
            }
        }
    }

    initialize() {
        global.ZeresPluginLibrary.PluginUpdater.checkForUpdate(this.getName(), this.getVersion(), "https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Double-click-to-edit/DoubleClickToEdit.plugin.js");

        document.addEventListener('dblclick', this.handler);

        //So at the launch it kinda gets scuffed, sooo.
        setTimeout(function () {
            DoubleClickToEdit.myID = BdApi.findModuleByProps("getCurrentUser").getCurrentUser().id;
        }, 1000);
    }

    stop() {
        document.removeEventListener('dblclick', this.handler);
    }

    handler(e) {
        //Target the message
        let messagediv = e.target.closest('[class^=message]');
        //If it finds nothing, null it.
        if (!messagediv)
            return;

        //Make sure we're not resetting when the message is already in edit-mode.
        let selected = BdApi.findModuleByProps("message", "selected").selected;
        if (messagediv.classList.contains(selected))
            return;

        //Basically make a HTMLElement/Node interactable with it's React components.
        let instance = messagediv[Object.keys(messagediv).find(key => key.startsWith("__reactInternal"))];
        //This is filled with the message top to bottom,
        //if it has a quote the quote will be "message".
        let message = instance && getValueFromKey(instance, "message");
        //As a result, this will be the actual message you want to edit.
        let baseMessage = instance && getValueFromKey(instance, "baseMessage");

        //Check if the quote or standalone message is yours.
        let msgYours = messageYours(message, DoubleClickToEdit.myID);
        //If double clicked a message with a quote, check if the "base"-message is yours.
        let baseMsgYours = messageYours(baseMessage, DoubleClickToEdit.myID);
    
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

        //Execution
        BdApi.findModuleByProps("receiveMessage", "editMessage").startEditMessage(message.channel_id, message.id, message.content);
    }
}

var whitelist = {
    memoizedProps: true,
    child: true,
    sibling: true
};
var blacklist = {
    contextSection: true
};

function messageYours(message, id) {
    if (!message)
        return undefined;

    if (message.author.id !== id)
        return false;

    return true;
}

function getValueFromKey(instance, searchkey) {
    var result = undefined;
    if (instance && !Node.prototype.isPrototypeOf(instance)) {
        let keys = Object.getOwnPropertyNames(instance);
        for (let i = 0; result === undefined && i < keys.length; i++) {
            let key = keys[i];

            if (key && !blacklist[key]) {
                var value = instance[key];

                if (searchkey === key)
                    result = value;

                else if ((typeof value === "object" || typeof value === "function") &&
                    (whitelist[key] || key[0] == "." || !isNaN(key[0])))
                    result = getValueFromKey(value, searchkey);
            }
        }
    }
    return result;
}
