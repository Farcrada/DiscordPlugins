/**
 * @name FixUpload
 * @author Farcrada
 * @version 1.0.0
 * @description Fix upload-button back to a single click operation.
 * 
 * @website https://github.com/Farcrada/DiscordPlugins
 * @source https://github.com/Farcrada/DiscordPlugins/blob/master/Fix-Upload/FixUpload.plugin.js
 * @updateUrl https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Fix-Upload/FixUpload.plugin.js
 */


const config = {
    info: {
        name: "Fix Upload",
        id: "FixUpload",
        description: "Fix upload-button back to a single click operation.",
        version: "1.0.0",
        author: "Farcrada",
        updateUrl: "https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Fix-Upload/FixUpload.plugin.js"
    }
}


class FixUpload {
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

    initialize() {
        BdApi.Patcher.after(config.info.id, BdApi.findModule(m => m?.default?.displayName === "ChannelAttachMenu"), "default", (that, methodArguments, returnValue) => {
            //Define props
            let props = methodArguments[0];

            //Delete the subtext from the returnValue
            delete returnValue.props.children.find(e => e.key === "upload-file").props.subtext;

            //If options proves to be empty; exit.
            if (!props.options || props.options.length > 1 || props.options[0]?.type !== "UPLOAD_A_FILE")
                return;

            //Close the popup (since it got clicked)
            props.onClose();
            //And make sure we go straight into upload.
            props.onFileUpload();
        });
    }

    stop() { BdApi.Patcher.unpatchAll(config.info.id); }
}
