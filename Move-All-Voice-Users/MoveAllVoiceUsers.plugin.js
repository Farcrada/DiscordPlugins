/**
 * @name MoveAllVoiceUsers
 * @author Farcrada
 * @version 0.9.0
 * @description Moves all users in a particular voice chat.
 * 
 * @website https://github.com/Farcrada/DiscordPlugins
 * @source https://github.com/Farcrada/DiscordPlugins/blob/master/Move-All-Voice-Users/MoveAllVoiceUsers.plugin.js
 * @updateUrl https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Move-All-Voice-Users/MoveAllVoiceUsers.plugin.js
 */


const config = {
    info: {
        name: "Move All Voice Users",
        id: "MoveAllVoiceUsers",
        description: "Moves all users in a particular voice chat.",
        version: "0.9.0",
        author: "Farcrada",
        updateUrl: "https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Move-All-Voice-Users/MoveAllVoiceUsers.plugin.js"
    }
}


class MoveAllVoiceUsers {
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
        //We use this instead of the constructor() to make sure we only do activity when we are started.
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
        //Guild context menu.
        this.guildUserContextMenus = BdApi.findModule(m => m?.default?.displayName === "GuildChannelUserContextMenu");
        this.guildChannelContextMenus = BdApi.findAllModules(m => m?.default?.displayName === "ChannelListVoiceChannelContextMenu")[0];

        //We only need select functions; spread out over several stores
        this.hasPermission = BdApi.findModuleByProps("getHighestRole").can;
        this.setChannel = BdApi.findModuleByProps("setChannel").setChannel;
        this.getChannel = BdApi.findModuleByProps("getChannel", "getDMFromUserId").getChannel;
        this.getGuild = BdApi.findModuleByProps("getGuild").getGuild;
        this.getVoiceChannelId = BdApi.findModuleByProps("getVoiceChannelId").getVoiceChannelId;
        this.getVoiceStatesForChannel = BdApi.findModuleByProps("getVoiceStatesForChannel").getVoiceStatesForChannel;

        //Types
        this.DiscordPermissionsTypes = BdApi.findModuleByProps("Permissions").Permissions;

        //React and shit
        this.ce = BdApi.React.createElement;
        this.ContextControls = BdApi.findModuleByProps("MenuGroup", "MenuItem");

        //Patch the boys
        this.patchGuildUserContext();
        this.patchGuildChannelContext();
    }

    stop() { BdApi.Patcher.unpatchAll(config.info.id); }

    patchGuildChannelContext() {
        BdApi.Patcher.after(config.info.id, this.guildChannelContextMenus, "default", (that, methodArguments, returnValue) => {
            this.moveAllUsers(methodArguments[0].channel, returnValue, true);
        });
    }

    patchGuildUserContext() {
        BdApi.Patcher.after(config.info.id, this.guildUserContextMenus, "default", (that, methodArguments, returnValue) => {
            this.moveAllUsers(this.getChannel(methodArguments[0].channelId), returnValue);
        });
    }

    moveAllUsers(channel, returnValue, channelOrUser) {
        //If there's no channel... ¯\_(ツ)_/¯
        if (!channel)
            return;

        //Get the current channel
        let curChannelData = this.getCurrentChannelData();
        if (!(curChannelData && curChannelData.count > 1))
            return;

        //Check the permissions
        if (!this.canMove(channel, curChannelData))
            return;

        //Is it a channel?
        if (channelOrUser)
            returnValue.props.children[1].props.children.push(this.renderElement(channel, curChannelData, this.ContextControls.MenuGroup));
        //Then it's a user
        else
            //                The element   |context sections |items in the section
            returnValue.props.children.props.children[6].props.children.push(this.renderElement(channel, curChannelData));
    }

    canMove(channel, curChannelData) {
        //If not the same channel AND
        if (curChannelData.channel.id !== channel.id &&
            //In the same guild AND
            curChannelData.channel.guild_id === channel.guild_id &&
            //We are an administrator in a server OR
            (this.hasPermission(this.DiscordPermissionsTypes.ADMINISTRATOR, this.getGuild(channel.guild_id)) ||
                //We have the required permissions such as being able to connect to the target channel AND
                (this.hasPermission(this.DiscordPermissionsTypes.CONNECT, channel) &&
                    //We can move members
                    this.hasPermission(this.DiscordPermissionsTypes.MOVE_MEMBERS, channel))))
            //Which means we can move
            return true;
        //Otherwise, obviously not.
        return false;
    }

    getCurrentChannelData() {
        //Get our current channel
        let curChannel = this.getChannel(this.getVoiceChannelId());
        if (!curChannel)
            return null;

        //Get the member IDs from the current VoiceStates
        let members = Object.keys(this.getVoiceStatesForChannel(curChannel.id));
        if (curChannel && members)
            return { channel: curChannel, members, count: members.length };

        //If nothing; null
        return null;
    }

    renderelement(channel, curChannelData, group) {
        return this.ce(group, null, renderElement(channel, curChannelData));
    }

    renderElement(channel, curChannelData) {
        return this.ce(this.ContextControls.MenuItem, {
            id: 'move-all-vc',
            label: 'Move All',
            action: () => {
                for (let member of curChannelData.members)
                    //               in what guild     who     to where
                    this.setChannel(channel.guild_id, member, channel.id);
            }
        });
    }
}
