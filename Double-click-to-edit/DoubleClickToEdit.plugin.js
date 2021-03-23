/**
 * @name DoubleClickToEdit
 * 
 * @website https://github.com/Farcrada/DiscordPlugins/
 * @source https://github.com/Farcrada/DiscordPlugins/blob/master/Double-click-to-edit/DoubleClickToEdit.plugin.js
 */


class DoubleClickToEdit {
    getName() { return "Double click to edit"; }
    getDescription() { return "Double click messages to edit them."; }
    getVersion() { return "9.0.9"; }
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

        if (global.ZeresPluginLibrary) this.initialize();

        try {
            document.addEventListener('dblclick', this.handler);
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
        ZeresPluginLibrary.PluginUpdater.checkForUpdate(this.getName(), this.getVersion(), "https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Double-click-to-edit/DoubleClickToEdit.plugin.js");

        DoubleClickToEdit.myID = BdApi.findModuleByProps("getCurrentUser").getCurrentUser().id;
    }

    stop() {
        document.removeEventListener('dblclick', this.handler);
    }

    handler(e) {
        let messagediv = e.target.closest('[class^=message]');

        if (!messagediv || !messagediv.classList.contains('da-zalgo'))
            return;

        let instance = messagediv[Object.keys(messagediv).find(key => key.startsWith("__reactInternal"))];
        let message = instance && getValueFromKey(instance, "message");
        let baseMessage = instance && getValueFromKey(instance, "baseMessage");

        let msgYours = messageYours(message, DoubleClickToEdit.myID);
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
