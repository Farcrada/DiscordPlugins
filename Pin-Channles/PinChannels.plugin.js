/**
 * @name PinChannels
 * @author Farcrada
 * @version 0.5.2
 * @description Pin a channel to the top for easy access.
 * 
 * @website https://github.com/Farcrada/DiscordPlugins
 * @source https://github.com/Farcrada/DiscordPlugins/blob/master/Pin-Channels/PinChannels.plugin.js
 * @updateUrl https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Pin-Channels/PinChannels.plugin.js
 */


const config = {
    info: {
        name: "Pin Channels",
        id: "PinChannels",
        description: "Pin a channel to the top for easy access.",
        version: "0.5.2",
        author: "Farcrada",
        updateUrl: "https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Pin-Channels/PinChannels.plugin.js"
    },
    settings: {
        guilds: {}
    }
}


class PinChannels {
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
                console.error("Attempting to stop after initialization error...")
                this.stop();
            }
            catch (err) {
                console.error(this.getName() + ".stop()", err);
            }
        }
    }

    initialize() {
        //Create our cache
        createCache();

        //Patch the channel context menu
        patchChannelContextMenu();
        patchChannelList();
    }

    stop() { BdApi.Patcher.unpatchAll(config.info.id); }
}

function createCache() {
    ///             NEEDS WORK, CRASHES ON STARTUP. COULD DELAY BUT LAZY
    ///                         Basically gotta patch/fix `ChannelItemIcon` and probably `ChannelItem` et all.

    //Load in our saved channels (if any)
    //config.settings.guilds = BdApi.loadData(config.info.id, "guilds") ?? {};

    ///             Oh well.

    //The one we need is at 0
    PinChannels.patchChannelContextMenu = BdApi.findAllModules(m => m.default && m.default.displayName.includes("ChannelListTextChannelContextMenu"))[0];
    //Guild's properties about the channel list. This gets called when you navigate to a guild.
    PinChannels.patchChannelList = BdApi.findModule(m => m.default && m.default.displayName === "NavigableChannels");
    //The function to create new channel objects
    PinChannels.Channel = BdApi.findModuleByPrototypes("getRecipientId", "isManaged", "getGuildId");
    //Discord's channel constants
    PinChannels.ChannelTypes = BdApi.findModuleByProps("Permissions", "ActivityTypes").ChannelTypes;

    //Context shit
    PinChannels.ce = BdApi.React.createElement;
    //Context controls (mainly just the one item we insert)
    PinChannels.MenuItem = BdApi.findModuleByProps("MenuRadioItem", "MenuItem").MenuItem;

}

function patchChannelContextMenu() {
    //Patch in our context item under our name
    BdApi.Patcher.after(config.info.id, PinChannels.patchChannelContextMenu, "default", (that, methodArguments, returnValue) => {
        //Enter the world of patching
        let props = methodArguments[0];
        //Get the channel and guild properties 
        let { channel, guild } = props;

        //Convert the Mute section to an array, if it isn't already:
        if (!Array.isArray(returnValue.props.children[1].props.children))
            returnValue.props.children[1].props.children = new Array(returnValue.props.children[1].props.children);

        //Check if we have the channel already
        if (config.settings.guilds[props.guild.id])
            if (config.settings.guilds[props.guild.id].filter(c => c.id === channel.id).length > 0) {
                //push and insert our context item
                returnValue.props.children[1].props.children.push(
                    PinChannels.ce(PinChannels.MenuItem, {
                        label: "Unpin Channel",
                        id: config.info.name.toLowerCase().replace(' ', '-'),
                        action: () => {
                            //Remove the channel
                            removeChannel(channel, guild);
                        }
                    })
                );
                return;
            }

        //if not, offer a pin
        //push and insert our context item
        returnValue.props.children[1].props.children.push(
            PinChannels.ce(PinChannels.MenuItem, {
                label: "Pin Channel",
                id: config.info.name.toLowerCase().replace(' ', '-'),
                action: () => {
                    //Save the channel
                    saveChannel(channel, guild);
                }
            })
        );
    });
}

function patchChannelList() {
    BdApi.Patcher.after(config.info.id, PinChannels.patchChannelList, "default", (that, methodArguments, returnValue) => {
        //Enter the world of patching
        let props = methodArguments[0];

        //Need a unique ID, this'll do.
        let pinnedId = `${props.guild.id}_pinned`;

        //Cleanup.
        if (props.categories[pinnedId])
            delete props.categories[pinnedId];
        props.categories._categories = props.categories._categories.filter(n => n.channel.id !== pinnedId);
        props.channels[PinChannels.ChannelTypes.GUILD_CATEGORY] = props.channels[PinChannels.ChannelTypes.GUILD_CATEGORY].filter(n => n.channel.id !== pinnedId);
        props.channels.SELECTABLE = props.channels.SELECTABLE.filter(n => n.channel.parent_id !== pinnedId);

        //                ---Cheatsheet---
        //
        //props.categories = [          props.channels = [
        //     id: {                         TYPE: {
        //        n: {                          n: {
        //            channel,                      comparator,
        //            index                         channel
        //        },                            },
        //        n + 1: {                      n + 1: {
        //            channel,                      comparator,
        //            index                         channel
        //        }                             }
        //     }                            }
        //];                            ];

        //Loop through ALL channels.
        //catId = id
        let index = -1;
        for (let catId in props.categories) {
            //Skip categories as we don't want (allow?) to pin them\
            if (catId === "_categories")
                continue;

            //Check if we have this guild saved
            if (config.settings.guilds[props.guild.id])
                //Fill it with everything but our pinned channels.
                //                                 props.categories.id.  n
                props.categories[catId] = props.categories[catId].filter(n => !config.settings.guilds[props.guild.id].forEach(c => c.id === n.channel.id));

            //Get a unique but latest index
            for (let channelObj of props.categories[catId])
                if (channelObj.index > index)
                    index = parseInt(channelObj.index);
        }




        //Construct our category
        let pinnedCategory = new PinChannels.Channel({
            guild_id: props.guild.id,
            id: pinnedId,
            name: "pinned",
            type: PinChannels.ChannelTypes.GUILD_CATEGORY
        });

        //Predefine our category
        props.categories[pinnedId] = [];
        //Push it into the category-library (at the top)
        props.categories._categories.splice(0, 0, {
            channel: pinnedCategory,
            //increase BEFORE submitting
            index: ++index
        });
        //Push our category into the channel-library as well at the start
        props.channels[PinChannels.ChannelTypes.GUILD_CATEGORY].splice(0, 0, {
            //Get a unique but latest comparator
            comparator: (props.channels[PinChannels.ChannelTypes.GUILD_CATEGORY][props.channels[PinChannels.ChannelTypes.GUILD_CATEGORY].length - 1] || { comparator: 0 }).comparator + 1,
            channel: pinnedCategory
        });

        //Check if we have something saved here
        if (config.settings.guilds[props.guild.id])
            //Loop through our saved channels
            for (let i = 0; i < config.settings.guilds[props.guild.id].length; i++) {
                //Create a new channel instance (so we now have a clone)
                let pinnedChannel = new PinChannels.Channel(Object.assign({}, config.settings.guilds[props.guild.id][i], {
                    parent_id: pinnedId
                }));
                //Push our clone into our category
                props.categories[pinnedId].push({
                    channel: pinnedChannel,
                    index: pinnedChannel.position
                });
                //And make sure it's in the SELECTABLE
                props.channels["SELECTABLE"].push({
                    comparator: pinnedChannel.position,
                    channel: pinnedChannel
                });
            }

        console.log(props, returnValue);
    });
}

function saveChannel(channel, guild) {
    if (!config.settings.guilds[guild.id])
        config.settings.guilds[guild.id] = [];

    config.settings.guilds[guild.id].push(channel);
    console.log(config.settings.guilds);
    saveSettings();
}

function removeChannel(channel, guild) {
    switch (config.settings.guilds[guild.id].length) {
        case 0:
            console.log("wtf");
            break;
        case 1:
            config.settings.guilds = Object.fromEntries(Object.entries(config.settings.guilds).filter(function ([key, value]) { return key !== guild.id }));
            break;
        default:
            config.settings.guilds[guild.id] = config.settings.guilds[guild.id].filter(c => c !== channel);
            break;
    }

    console.log(config.settings.guilds);
    saveSettings(true);
}

function saveSettings(removed) {
    BdApi.saveData(config.info.id, "guilds", config.settings.guilds);

    if (removed)
        BdApi.showToast("Channel removed", { type: "error", icon: false });
    else
        BdApi.showToast("Channel added", { type: "success", icon: false });
}
