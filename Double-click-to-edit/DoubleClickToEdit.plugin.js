/**
 * @name DoubleClickToEdit
 * 
 * @website https://github.com/Farcrada/DiscordPlugins/
 * @source https://github.com/Farcrada/DiscordPlugins/blob/master/Double-click-to-edit/DoubleClickToEdit.plugin.js
 */


class DoubleClickToEdit {
    getName() { return "Double click to edit"; }
    getDescription() { return "Double click messages to edit them."; }
    getVersion() { return "9.0.7"; }
    getAuthor() { return "Farcrada, original by Jiiks"; }

    start() {
        let libraryScript = document.getElementById("ZLibraryScript");
        if (!libraryScript || !window.ZLibrary) {
            if (libraryScript) libraryScript.parentElement.removeChild(libraryScript);
            libraryScript = document.createElement("script");
            libraryScript.setAttribute("type", "text/javascript");
            libraryScript.setAttribute("src", "https://rauenzi.github.io/BDPluginLibrary/release/ZLibrary.js");
            libraryScript.setAttribute("id", "ZLibraryScript");
            document.head.appendChild(libraryScript);
        }

        if (window.ZLibrary) this.initialize();

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
        ZLibrary.PluginUpdater.checkForUpdate(this.getName(), this.getVersion(), "https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Double-click-to-edit/DoubleClickToEdit.plugin.js");

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

        if (messageExists(message, DoubleClickToEdit.myID)) {
            let baseMessage = instance && getValueFromKey(instance, "baseMessage");
            if (baseMessage && !messageExists(baseMessage, DoubleClickToEdit.myID))
                return;
        }
        else
            return;

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

function messageExists(message, id) {
    if (!message)
        return false;

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
