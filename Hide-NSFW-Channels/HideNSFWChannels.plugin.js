/**
 * @name HideNSFWChannels
 * @author Farcrada
 * @version 2.1.0
 * @description Hide NSFW channels.
 * 
 * @website https://github.com/Farcrada/DiscordPlugins
 * @source https://github.com/Farcrada/DiscordPlugins/blob/master/Hide-NSFW-Channels/HideNSFWChannels.plugin.js
 * @updateUrl https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Hide-NSFW-Channels/HideNSFWChannels.plugin.js
 */


const config = {
    info: {
        name: "Hide NSFW Channels",
        id: "HideNSFWChannels",
        description: "Hide NSFW Channels.",
        version: "2.1.0",
        author: "Farcrada",
        updateUrl: "https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Hide-NSFW-Channels/HideNSFWChannels.plugin.js"
    },
    settings: {
        updater: false,
        awaitingUpdate: false,
        selective: true,
        channels: []
    }
}


class HideNSFWChannels {
    getName() { return config.info.name; }
    getDescription() { return config.info.description; }
    getVersion() { return config.info.version; }
    getAuthor() { return config.info.author; }

    start() {
        //Check if updater is enabled.
        if (config.settings.updater)
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
            this.initialize();
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
        //Check if updater is enabled.
        if (config.settings.updater && global.ZeresPluginLibrary)
            global.ZeresPluginLibrary.PluginUpdater.checkForUpdate(config.info.name, config.info.version, config.info.updateUrl);

        loadSettings();

        if (config.settings.selective)
            patchChannelContextMenu();
    }

    getSettingsPanel() {
        return buildSettingChildren([{
            type: "toggle",
            label: "Enable updater (Toggle back and forth to only enable for this session)",
            checked: config.settings.updater,
            action: (event) => {
                //For some reason the "action" only gives the mouse event...
                //The toggle isn't passed, though it is handled. Unfortunate.
                let toggled;
                if (event.target.ariaChecked)
                    toggled = !(event.target.ariaChecked === "true");
                else
                    toggled = !(event.target.closest('[role=button]').ariaChecked === "true");

                config.settings.updater = toggled;
                if (config.settings.updater)
                    global.ZeresPluginLibrary.PluginUpdater.checkForUpdate(config.info.name, config.info.version, config.info.updateUrl);
                saveSettings();
            }
        },
        {
            type: "toggle",
            label: "Selective mode (Turn this on to right-click select what channels are hidden)",
            checked: config.settings.selective,
            action: (event) => {
                //For some reason the "action" only gives the mouse event...
                //The toggle isn't passed, though it is handled. Unfortunate.
                let toggled;
                if (event.target.ariaChecked)
                    toggled = !(event.target.ariaChecked === "true");
                else
                    toggled = !(event.target.closest('[role=button]').ariaChecked === "true");

                config.settings.selective = toggled;
                //Only update when it is toggled off
                config.settings.awaitingUpdate = true;
                if (config.settings.selective)
                    patchChannelContextMenu();
                else
                    BdApi.Patcher.unpatchAll(config.info.id);
                //Save settings;
                saveSettings();
            }
        },
        {
            type: "seperator",
            label: "Toggle off the channels below to no longer hide them."
        }].concat(settingsChannels()));
    }

    //Gotta remove all our patches
    stop() { BdApi.Patcher.unpatchAll(config.info.id); }

    //For ease, just make use of the tools we have
    //This also stops as soon as the plugin is stopped/disabled
    observer(changes) {
        //Dirty check for if we are awaiting any updates on selective === true
        //(previously hidden NSFW channels)
        if (config.settings.awaitingUpdate)
            processAwaitingUpdate();

        //Check if a node is being added, that's where our focus lies.
        if (changes.addedNodes.length < 1)
            return;

        //Since it's a NodeList, lets array this bitch.
        //But since you can't break in a .forEach(), we opt for .every()
        Array.from(changes.addedNodes).every(node => {
            //Sometimes it's not a node, so we have to prevent errors there.
            if (node.nodeType !== Node.ELEMENT_NODE)
                //Basically means "continue" in .forEach() language
                return true;

            //Sometimes it enters something that has no name
            if (!node.classList.contains(BdApi.findModuleByProps("containerDefault").containerDefault))
                return true;

            //Get the React properties and look for the Channel object
            let channel = findValue(getPropertyByKey(node, "__reactInternal"), "channel");
            if (!channel)
                return true;

            //Which contains the channel's NSFW flag
            if (!channel.nsfw)
                return true;

            //And of course it's ID
            toggleNSFWChannel(node, channel.id);
        });
    }
}

function loadSettings() {
    config.settings.updater = !!BdApi.loadData(config.info.id, "updater");
    config.settings.selective = !!BdApi.loadData(config.info.id, "selective");
    config.settings.channels = BdApi.loadData(config.info.id, "channels") ?? [];
}

function saveSettings(added = false) {
    BdApi.loadData(config.info.id, "updater", config.settings.updater);
    BdApi.saveData(config.info.id, "selective", config.settings.selective);
    BdApi.saveData(config.info.id, "channels", config.settings.channels);
    if (added)
        BdApi.showToast("Channel added", { type: "success", icon: false });
    else
        BdApi.showToast("Edit saved", { type: "success", icon: false });
}

function patchChannelContextMenu() {
    //There are 3 "ChannelListTextChannelContextMenu" modules,
    //but only the last one has an "makeOverride" scope with "default";
    //indicating this is the one to patch.
    let channelContextMenu = BdApi.findAllModules(m => m.default && m.default.displayName === "ChannelListTextChannelContextMenu")[2];
    //Patch in our context item under our name
    BdApi.Patcher.after(config.info.id, channelContextMenu, "default", (that, [props], returnValue) => {
        //Get the channel and guild properties 
        let { channel, guild } = props;

        //Check if this channel is tagged as NSFW
        if (!channel.nsfw)
            return;

        //Splice and insert our context item
        returnValue.props.children.splice(
            //We want it after the "mute" channel.
            2,
            0,
            buildContextItem({
                label: config.info.name,
                id: config.info.name.toLowerCase().replace(' ', '-'),
                action: () => {
                    //This should not be possible, but if it ever happens, simply hide it
                    if (!getChannel(channel.id)) {
                        let newChannel = {
                            //We need the server id, since there can be duplicates
                            server: guild.name,
                            server_id: guild.id,
                            //And even more so with channels
                            name: channel.name,
                            id: channel.id,
                            awaitingRemoval: false
                        };
                        //Handle the config and hard save
                        saveChannel(newChannel);
                    }
                    toggleNSFWChannel(getPropertyByKey(props, "target").closest('[class|=containerDefault]'), channel.id);
                }
            })
        );
    });
}

function toggleNSFWChannel(node, id = "") {
    let result = getChannel(id)
    //Make sure it at least is in the config
    if (!result)
        node.style.display = getSelective();
    //If it's not stored
    else
        //And make sure it is awaiting an update
        if (!result.awaitingRemoval)
            //if not it's awaiting an update.
            node.style.display = "none";
        else {
            //Remove it from the config
            removeChannel(id);

            node.style.display = getSelective();
        }
}

function processAwaitingUpdate() {
    //First we have to loop/find if anything is awaiting an update.
    let containerArray = document.querySelectorAll('[class|=containerDefault]');
    for (let container of containerArray) {
        //Get the React properties and look for the Channel object
        let channel = findValue(getPropertyByKey(container, "__reactInternal"), "channel");
        if (!channel)
            continue;
        //Which contains the channel's NSFW flag
        if (!channel.nsfw)
            continue;

        toggleNSFWChannel(container, channel.id);
    }
    //Stop updating
    config.settings.awaitingUpdate = false;
}

function getSelective() {
    //if it's selective
    if (config.settings.selective)
        //Return it to view
        return "block";
    else
        return "none";
}

function getChannel(id) {
    for (let i = 0; i < config.settings.channels.length; i++) {
        //If it isn't our ID skip
        if (config.settings.channels[i].id !== id)
            continue;
        //And if it is, return
        return config.settings.channels[i];
    }
    return false;
}

function saveChannel(newChannel) {
    config.settings.channels.push(newChannel);
    saveSettings(true);
}

function removeChannel(id) {
    config.settings.channels = config.settings.channels.filter(ch => ch.id !== id);
    //The saving is called at the end of an update (where channels are removed).
}

function settingsChannels() {
    let settingsChannels = [];
    for (let i = 0; i < config.settings.channels.length; i++) {
        settingsChannels.push({
            type: "toggle",
            label: `Channel: "${config.settings.channels[i].name}" in: "${config.settings.channels[i].server}" | ${config.settings.channels[i].id}`,
            id: `${config.settings.channels[i].id}`,
            checked: !config.settings.channels[i].awaitingRemoval,

            //This is where the for loop no longer works.
            //When a previous item is deleted the index is bigger than what is left in the array
            action: (event) => {
                //For some reason the "action" only gives the mouse event...
                //The toggle isn't passed, though it is handled. Unfortunate.
                let toggled, element;
                if (event.target.ariaChecked) {
                    element = event.target;
                    toggled = !(event.target.ariaChecked === "true");
                }
                else {
                    element = event.target.closest('[role=button]');
                    toggled = !(event.target.closest('[role=button]').ariaChecked === "true");
                }

                let channelID = element.querySelector(`.${BdApi.findModuleByProps("item", "label").label}`).innerText.split('|')[1].trim();
                let index = config.settings.channels.indexOf(getChannel(channelID));

                //And, well, reverse the boolean,
                //because a toggle means it needs to come back.
                config.settings.awaitingRemoval = !toggled;
                config.settings.channels[index].awaitingUpdate = !toggled;
                element.remove();
                //Save settings;
                saveSettings();
            }
        });
    }
    return settingsChannels;
}


const ce = BdApi.React.createElement;
const MenuControls = BdApi.findModuleByProps("RadioItem", "Item");

function buildContextItem(item) {
    return ce(BdApi.findModuleByProps("MenuRadioItem", "MenuItem").MenuItem, {
        ...item,
        id: item.id
    });
}

function buildSettingItem(props) {
    let { type } = props;

    let Component;
    switch (type) {
        case "separator":
            return ce(MenuControls.Separator);
        case "toggle":
            Component = MenuControls.CheckboxItem;
            break;
        default:
            Component = MenuControls.Item
            break;
    }
    props.extended = true;
    return ce(Component, props);
}

function buildSettingChildren(setup) {
    let mapper = s => {
        return buildSettingItem(s);
    };
    return setup.map(mapper).filter(i => i);
}

function getPropertyByKey(object, key) {
    return object[Object.keys(object).find(k => k.startsWith(key))]
}

function findValue(instance, searchkey) {
    //Where to search
    var whitelist = {
        memoizedProps: true,
        child: true
    };
    //Where not to search
    var blacklist = {
        contextSection: true
    };

    return getKey(instance);

    function getKey(instance) {
        //In case the result is never filled, predefine it.
        var result = undefined;
        //Check if it exists
        if (instance && !Node.prototype.isPrototypeOf(instance)) {
            //Filter inherited properties
            let keys = Object.getOwnPropertyNames(instance);
            //As long as result is undefined and within keys.length; loop
            for (let i = 0; result === undefined && i < keys.length; i++) {
                let key = keys[i];

                //Make sure the property's not blacklisted
                if (key && !blacklist[key]) {
                    var value = instance[key];

                    //if this is the key we're looking for, return it
                    if (searchkey === key)
                        return value;

                    //If it's an object or function and it is white
                    else if ((typeof value === "object" || typeof value === "function") &&
                        (whitelist[key] || key[0] == "." || !isNaN(key[0])))
                        result = getKey(value);
                }
            }
        }
        return result;
    }
}
