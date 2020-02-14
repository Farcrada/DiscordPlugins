//META{"name":"DoubleClickToEdit","displayName":"DoubleClickToEdit","website":"https://github.com/Farcrada/Double-click-to-edit","source":"https://github.com/Farcrada/Double-click-to-edit/blob/master/DoubleClickToEdit.plugin.js"}*//

class DoubleClickToEdit {
    getName() { return "Double click to edit"; }
    getDescription() { return "Double click messages to edit them."; }
    getVersion() { return "9.0.0"; }
    getAuthor() { return "Farcrada, original by Jiiks"; }

    start() {
        this.settings = { clickCount: 2 };
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
            this.cb = e=> this.handler(e)
            document.addEventListener('click', this.cb);
        }
        catch(err) {
            console.error(this.getName(), "fatal error, plugin could not be started!", err);
            
            try {
                this.stop();
            }
            catch(err) {
                console.error(this.getName() + ".stop()", err);
            }
        }
    }
    
    getSettingsPanel() {
        return new ZLibrary.Settings.SettingPanel(null,new ZLibrary.Settings.Textbox("Number of clicks", "How many consecutive clicks are required to edit the message", this.settings.clickCount,
        txt => {
            this.settings.clickCount = Number(txt) || 2;
            ZLibrary.PluginUtilities.saveData("dblClickEdit", "settings", this.settings);
        },
        {placeholder: "2"})).getElement();
        
    }
    
    loadSettings() {
        const storage = ZLibrary.PluginUtilities.loadData("dblClickEdit", "settings");
        if (storage)
            this.settings = storage;
        else
            ZLibrary.PluginUtilities.saveData("dblClickEdit", "settings", this.settings);
    }

    initialize() {
        ZLibrary.PluginUpdater.checkForUpdate(this.getName(), this.getVersion(), "https://raw.githubusercontent.com/Farcrada/Double-click-to-edit/master/DoubleClickToEdit.plugin.js");
        this.loadSettings();
    }

    stop() {
        document.removeEventListener('click', this.cb);
    }
    
    handler(e) {
        if (e.which != 1 || e.detail<this.settings.clickCount)
            return;
        
        let messagediv = e.target.closest('[class^=message]');

        if (!messagediv)
            return;

        let instance = messagediv[Object.keys(messagediv).find(key => key.startsWith("__reactInternal"))];
        let message = instance && findValue(instance, "message");
        
        if (!message)
            return;

        if (message.author.id !== BdApi.findModuleByProps("getCurrentUser").getCurrentUser().id)
            return;

        BdApi.findModuleByProps("receiveMessage", "editMessage").startEditMessage(message.channel_id, message.id, message.content);
        
        function findValue (instance, searchkey) {
            var whitelist = {
                memoizedProps: true,
                child: true,
            };
            var blacklist = {
                contextSection: true
            };
            
            return getKey(instance);
            
            function getKey(instance) {
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
                                result = getKey(value);
                        }
                    }
                }
                return result;
            }
        }
    }
}
