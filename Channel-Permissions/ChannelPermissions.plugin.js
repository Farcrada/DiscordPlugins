/**
 * @name ChannelPermissions
 * @author Farcrada
 * @version 3.6.3
 * @description Hover over channels to view their required permissions.
 * 
 * @website https://github.com/Farcrada/DiscordPlugins
 * @source https://github.com/Farcrada/DiscordPlugins/blob/master/Channel-Permissions/ChannelPermissions.plugin.js
 * @updateUrl https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Channel-Permissions/ChannelPermissions.plugin.js
 */


const config = {
    info: {
        name: "Channel Permissions",
        id: "ChannelPermissions",
        description: "Hover over channels to view their required permissions.",
        version: "3.6.3",
        author: "Farcrada",
        updateUrl: "https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Channel-Permissions/ChannelPermissions.plugin.js"
    },
    constants: {
        //Our name scheme (I should really apply the lesson I learned with unique names)
        cssStyle: "FarcradaTooltipCSS",
        tooltipLeft: "FarcradaTooltipLeft",
        tooltipLeftClosing: "FarcradaTooltipLeftClosing",
        tooltipFadeIn: "FarcradaTooltipCSSFadeIn",
        tooltipFadeOut: "FarcradaTooltipCSSFadeOut",
        animationTime: 100,
        colorAlpha: 0.6
    }
}


class ChannelPermissions {
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
                console.error("Attempting to stop after initialization error...", err)
                this.stop();
            }
            catch (err) {
                console.error(this.getName() + ".stop()", err);
            }
        }
    }

    //If everything is ok; "after" start()
    initialize() {
        //Create and cache our class variables
        this.createCache();

        BdApi.clearCSS(config.constants.cssStyle);

        BdApi.injectCSS(config.constants.cssStyle, `
@keyframes ${config.constants.tooltipFadeIn} {
    from {
        opacity: 0;
        transform: scale(0.95);
    }
}

@keyframes ${config.constants.tooltipFadeOut} {
    to {
        opacity: 0;
        transform: scale(0.95);
    }
}

.${config.constants.tooltipLeft} {
    transform-origin: left center;
    animation: ${config.constants.tooltipFadeIn} ${config.constants.animationTime}ms;
    width: 300px;
}

.${config.constants.tooltipLeftClosing} {
    transform-origin: left center;
    animation: ${config.constants.tooltipFadeOut} ${config.constants.animationTime}ms;
    width: 300px;
}`);
    }

    //Cache expensive `BdApi.findModule` calls.
    createCache() {
        //Lose/single classes
        this.sidebarScroller = BdApi.findModuleByProps("positionedContainer", "unreadBar").scroller;
        this.textarea = BdApi.findModuleByProps("textarea").textarea;
        this.scrollbarGhostHairline = BdApi.findModuleByProps("scrollbar").scrollbarGhostHairline;
        this.listItemTooltipClass = BdApi.findModuleByProps("listItemTooltip").listItemTooltip;

        //Class collections
        this.Role = BdApi.findModuleByProps("roleCircle", "roleName", "roleRemoveIcon");
        this.RoleList = BdApi.findModuleByProps("rolesList");
        this.layerClasses = BdApi.findModuleByProps("layer");
        this.tooltipClasses = BdApi.findModuleByProps("tooltip");

        //Stores
        this.PermissionStore = BdApi.findModuleByProps("Permissions", "ActivityTypes");
        this.CurrentUserStore = BdApi.findModuleByProps("getCurrentUser");

        //Cache the function, makes it easier.
        //We can't make these methods cleanly because that would make a `findModule` call.
        this.getGuild = BdApi.findModuleByProps("getGuild", "getGuilds").getGuild;
        this.getChannel = BdApi.findModuleByProps("getChannel", "getDMFromUserId").getChannel;
        this.getMember = BdApi.findModuleByProps("getMember", "getMembers").getMember;
        this.getUser = BdApi.findModuleByProps("getUser", "getUsers").getUser;
        //Store color converter (hex -> rgb) and d
        this.hex2rgb = BdApi.findModuleByProps("getDarkness", "isValidHex").hex2rgb;
    }

    mouseoverFunc = (e) => this.createChannelPermissionsToolTip(e);

    //The scroller is loaded in every server switch.
    //This is beneficial because adding a listener on start-up causes a null issue.
    observer(changes) {
        //If the node is added, it also means it was removed
        if (changes.addedNodes.length < 1)
            return;

        //Check every added node if it has our class.
        for (let i = 0; i < changes.addedNodes.length; i++) {
            //Cahce current node for readability;
            let node = changes.addedNodes[i];

            //Sometimes it's not a node, so we have to prevent errors there.
            if (node.nodeType !== Node.ELEMENT_NODE)
                continue;

            //If it doesn't include what we search; next.
            if (!node.innerHTML.includes(this.sidebarScroller))
                continue;

            //If it got added; it got removed. We simply need to add our listener again.
            document.querySelector(`.${this.sidebarScroller}`).addEventListener('mouseover', this.mouseoverFunc);
        }
    }

    //On every switch we make sure that any trailing or bugging tooltips get removed.
    //This sometimes occurs when the tooltip gets/is shown when you collapse a category.
    onSwitch() {
        let closingTooltips = document.querySelectorAll(`.${config.constants.tooltipLeftClosing}`)
        for (let i = 0; i < closingTooltips.length; i++)
            closingTooltips[i].remove();

        let tooltips = document.querySelectorAll(`.${config.constants.tooltipLeft}`);
        for (let i = 0; i < tooltips.length; i++)
            tooltips[i].remove();
    }

    stop() {
        //We also need to stop that activity if it's needed.
        document.querySelector(`.${this.sidebarScroller}`).removeEventListener('mouseover', this.createChannelPermissionsToolTip);

        BdApi.clearCSS(config.constants.cssStyle);
    }

    createChannelPermissionsToolTip(e) {
        //We start with the main channellist holder and target it.
        let container = e.target.closest('[class|=containerDefault]');
        //Halt if there's nothing present.
        if (!container)
            return;

        //Check the internals and look for the Channel property which contains the channel's ID.
        let instance = BdApi.getInternalInstance(container);
        let instanceChannel = this.findValue(instance, "channel");

        //This is what happens when consistency isn't upheld 
        if (!instanceChannel) {
            //Since the previous search was fruitless, we need to make it an object
            instanceChannel = {};
            //Then search /RELIABLY/ for the channel ID and fill the `id` property
            instanceChannel.id = this.findValue(instance, "data-list-item-id").replace(/[^0-9]/g, '');
        }

        //Once found we need the guild_id (server id) derrived from the channel hovered over

        let channel = this.getChannel(instanceChannel.id);
        let guild = this.getGuild(channel.guild_id);

        //Get the permissions of the parent, because permissions aren't inherited.
        if (channel.isThread())
            channel = this.getChannel(channel.parent_id);

        //Time to start the logic.
        //This returns the actual <div> which is made.
        let contentHTML = this.constructToolTipContent(this.getRoles(guild, channel));

        //Attach events to actually make it work, we don't need to remove these events as the element is destroyed.
        //we don't use `addEventListener` because it would simply stack. This replaces and will also take updates.
        container.onmouseenter = (e) => this.toolTipOnMouseEnter(container, contentHTML);
        container.onmouseleave = (e) => this.toolTipOnMouseLeave();
    }

    //Construct the tooltip's content from the given roles.
    constructToolTipContent(channelRolesAndTopic) {
        //Destructure all the allowed roles from the specific channel
        let { allowedRoles, allowedUsers, overwrittenRoles, deniedRoles, deniedUsers, topic } = channelRolesAndTopic;

        //Set up variable for the HTML string we need to display in our tooltiptext.
        let htmlString = `<div class = "${this.RoleList.bodyInnerWrapper}">`;

        //Start with the channel topic;
        //Check if it has a topic and regex-replace any breakage with nothing.
        if (topic && topic.replace(/[\t\n\r\s]/g, ""))
            htmlString += `<div class="${this.RoleList.bodyTitle}">
                        Topic:
                    </div>
                    <div class="${this.RoleList.note}">
                        <div class="${this.textarea} ${this.scrollbarGhostHairline}" style="display:inline-block;">
                            ${topic}
                        </div>
                    </div>`;

        //The allowed roles, and thus the overwritten roles (those the user already has)
        if (allowedRoles.length > 0 || overwrittenRoles.length > 0) {
            //Title
            htmlString += `<div class="${this.RoleList.bodyTitle}">
                        Allowed Roles:
                    </div>
                    <div class="${this.Role.root} ${this.RoleList.rolesList} ${this.RoleList.endBodySection}">`;

            //Loop through the allowed roles
            for (let role of allowedRoles) {
                let color = role.colorString ? this.rgba2array(this.hex2rgb(role.colorString, config.constants.colorAlpha)) : [255, 255, 255, config.constants.colorAlpha];
                htmlString += `<div class="${this.Role.role}" style="border-color: rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]});">
                            <div class="${this.Role.roleCircle}" style="background-color: rgb(${color[0]}, ${color[1]}, ${color[2]});">
                            </div>
                            <div aria-hidden="true" class="${this.Role.roleName}">
                                ${this.encodeToHTML(role.name)}
                            </div>
                        </div>`;
            }

            //Loop through the overwritten roles
            for (let role of overwrittenRoles) {
                let color = role.colorString ? this.rgba2array(this.hex2rgb(role.colorString, config.constants.colorAlpha)) : [255, 255, 255, config.constants.colorAlpha];
                htmlString += `<div class="${this.Role.role}" style="border-color: rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]});">
                            <div class="${this.Role.roleCircle}" style="background-color: rgb(${color[0]}, ${color[1]}, ${color[2]});">
                            </div>
                            <div aria-hidden="true" class="${this.Role.roleName}" style="text-decoration: line-through !important;">
                                ${this.encodeToHTML(role.name)}
                            </div>
                        </div>`;
            }

            //End it with a /div.
            htmlString += `</div>`;
        }
        //Check for allowed users
        if (allowedUsers.length > 0) {
            //Title
            htmlString += `<div class="${this.RoleList.bodyTitle}">
                        Allowed Users:
                    </div>
                    <div class="${this.Role.root} ${this.RoleList.rolesList} ${this.RoleList.endBodySection}">`;

            //Loop throught it
            for (let user of allowedUsers) {
                let color = user.colorString ? this.hex2rgb(user.colorString, config.constants.colorAlpha) : `rgba(255, 255, 255, ${config.constants.colorAlpha})`;
                htmlString += `<div class="${this.Role.role}" style="border-color: ${color};">
                            <div class="${this.Role.roleCircle}" style="background-color: ${color};">
                            </div>
                            <div class="${this.Role.roleName}">
                                ${this.encodeToHTML(user.nick ? user.nick : user.name)}
                            </div>
                        </div>`;
            }

            //End it.
            htmlString += `</div>`;
        }
        //Check for denied roles
        if (deniedRoles.length > 0) {
            //Title
            htmlString += `<div class="${this.RoleList.bodyTitle}">
                        Denied Roles:
                    </div>
                    <div class="${this.Role.root} ${this.RoleList.rolesList} ${this.RoleList.endBodySection}">`;

            //Loop throught it
            for (let role of deniedRoles) {
                let color = role.colorString ? this.rgba2array(this.hex2rgb(role.colorString, config.constants.colorAlpha)) : [255, 255, 255, config.constants.colorAlpha];
                htmlString += `<div class="${this.Role.role}" style="border-color: rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]});">
                            <div class="${this.Role.roleCircle}" style="background-color: rgb(${color[0]}, ${color[1]}, ${color[2]});">
                            </div>
                            <div class="${this.Role.roleName}">
                                ${this.encodeToHTML(role.name)}
                            </div>
                        </div>`;
            }

            //End it.
            htmlString += `</div>`;
        }
        //Check for denied users
        if (deniedUsers.length > 0) {
            //Title
            htmlString += `<div class="${this.RoleList.bodyTitle}">
                        Denied Users:
                    </div>
                    <div class="${this.Role.root} ${this.RoleList.rolesList} ${this.RoleList.endBodySection}">`;

            //Loop through it.
            for (let user of deniedUsers) {
                let color = user.colorString ? this.rgba2array(this.hex2rgb(user.colorString, config.constants.colorAlpha)) : [255, 255, 255, config.constants.colorAlpha];
                htmlString += `<div class="${this.Role.role}" style="border-color: rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]});">
                            <div class="${this.Role.roleCircle}" style="background-color: rgb(${color[0]}, ${color[1]}, ${color[2]});">
                            </div>
                            <div class="${this.Role.roleName}">
                                ${this.encodeToHTML(user.nick ? user.nick : user.name)}
                            </div>
                        </div>`;
            }

            //End it.
            htmlString += `</div>`;
        }
        htmlString += `</div>`;

        //If we have anything we need to create the tooltip.
        if (htmlString)
            //This'll daisychain return the constructed <span>
            return htmlString;
        else {
            //And if it fucked up we got nothing.
            return undefined;
        }
    }

    //Get the roles of that channel
    getRoles(guild, channel) {

        let overrideTypes = Object.keys(this.PermissionStore.PermissionOverrideType);
        //Store yourself and create all the role sections.
        let myMember = this.getMember(guild.id, this.CurrentUserStore.getCurrentUser().id);
        let allowedRoles = [], allowedUsers = [], overwrittenRoles = [], deniedRoles = [], deniedUsers = [];
        let everyoneDenied = false;

        //So much text, lets improve readability.
        let channelOW = channel.permissionOverwrites;
        let permissionOverrideTypes = this.PermissionStore.PermissionOverrideType;
        let permissionTypes = this.PermissionStore.Permissions;

        //Loop through all the permissions
        for (let id in channelOW) {
            //Check if the current permission type is a role
            if ((channelOW[id].type == permissionOverrideTypes.ROLE ||
                overrideTypes[channelOW[id].type] == permissionOverrideTypes.ROLE) &&
                //And if it's not just @everyopne role
                (guild.roles[id] && guild.roles[id].name != "@everyone") &&
                //Check if it's an allowing permission via bitwise OR
                ((channelOW[id].allow | permissionTypes.VIEW_CHANNEL) == channelOW[id].allow ||
                    (channelOW[id].allow | permissionTypes.CONNECT) == channelOW[id].allow)) {

                //Stripe through those the user has
                if (myMember.roles.includes(id))
                    overwrittenRoles.push(guild.roles[id]);
                //And save the rest
                else
                    allowedRoles.push(guild.roles[id]);
            }
            //Check if permission is for a single user instead of a role
            else if ((channelOW[id].type == permissionOverrideTypes.MEMBER ||
                overrideTypes[channelOW[id].type] == permissionOverrideTypes.MEMBER) &&
                //Check if it's an allowing permission via bitwise OR
                ((channelOW[id].allow | permissionTypes.VIEW_CHANNEL) == channelOW[id].allow ||
                    (channelOW[id].allow | permissionTypes.CONNECT) == channelOW[id].allow)) {

                //Specific allowed users get added to their own section
                let user = this.getUser(id);
                let member = this.getMember(guild.id, id);

                if (user && member)
                    allowedUsers.push(Object.assign({ name: user.username }, member));
            }
            //Same as the allowed but now for denied roles
            if ((channelOW[id].type == permissionOverrideTypes.ROLE ||
                overrideTypes[channelOW[id].type] == permissionOverrideTypes.ROLE) &&
                //Check if it's an denying permission via bitwise OR
                ((channelOW[id].deny | permissionTypes.VIEW_CHANNEL) == channelOW[id].deny ||
                    (channelOW[id].deny | permissionTypes.CONNECT) == channelOW[id].deny)) {

                //Specific everyone denied
                deniedRoles.push(guild.roles[id]);

                //If @everyone is denied set the variable to represent this.
                if (guild.roles[id].name == "@everyone")
                    everyoneDenied = true;
            }
            //Same as the allowed but now for denied users
            else if ((channelOW[id].type == permissionOverrideTypes.MEMBER ||
                overrideTypes[channelOW[id].type] == permissionOverrideTypes.MEMBER) &&
                //Check if it's an denying permission via bitwise OR
                ((channelOW[id].deny | permissionTypes.VIEW_CHANNEL) == channelOW[id].deny ||
                    (channelOW[id].deny | permissionTypes.CONNECT) == channelOW[id].deny)) {

                //Specific denied users
                let user = this.getUser(id);
                let member = this.getMember(guild.id, id);

                if (user && member)
                    deniedUsers.push(Object.assign({ name: user.username }, member));
            }
        }

        //The only logical assumption if @everyone isn't denied.
        if (!everyoneDenied)
            allowedRoles.push({ "name": "@everyone" });

        //Apparently we can't pass this as is, so....
        let topic = channel.topic;

        //Now return the roles and topic from the channel to be destructured
        return { allowedRoles, allowedUsers, overwrittenRoles, deniedRoles, deniedUsers, topic };
    }

    //Event for when the mouse enters the channel
    toolTipOnMouseEnter(container, contentHTML) {
        //Destroy other closing elements to make sure it doesn't look weird.
        let closingTooltip = document.querySelector(`.${config.constants.tooltipLeftClosing}`)
        if (closingTooltip)
            closingTooltip.remove();

        //The wrapper
        let wrapper = document.createElement('div');

        //Construct the tooltip.
        wrapper.innerHTML = `<div class="${this.layerClasses.layer} ${this.layerClasses.disabledPointerEvents} ${config.constants.tooltipLeft}">
    <div class="${this.tooltipClasses.tooltip} ${this.tooltipClasses.tooltipRight} ${this.tooltipClasses.tooltipPrimary} ${this.tooltipClasses.tooltipDisablePointerEvents} ${this.listItemTooltipClass}" style="white-space:normal !important;">
        <div class="${this.tooltipClasses.tooltipPointer}">
        </div>
        <div class="${this.tooltipClasses.tooltipContent}">
            ${contentHTML}
        </div>
    </div>
</div>`;

        //This is so fkn scuffed. I need a better solution for this.
        document.querySelector(`#app-mount > .${this.layerClasses.layerContainer}`).appendChild(wrapper.firstChild);
        //But oh well.
        let tooltipElement = document.querySelector(`.${config.constants.tooltipLeft}`);

        //Get the box centered and next to the channel.
        let containerRight = parseInt(container.getBoundingClientRect().right);
        let containerTop = parseInt(container.getBoundingClientRect().top) + (container.offsetHeight * 0.5) - (tooltipElement.offsetHeight * 0.5);
        tooltipElement.style = `position: absolute; top: ${containerTop.toString()}px; left: ${(containerRight + 10).toString()}px;`;
    }

    //Event for when the mouse leaves the channel
    toolTipOnMouseLeave() {
        //Acquire the element, initiate the removal
        let tooltip = document.querySelector(`.${config.constants.tooltipLeft}`)
        if (tooltip)
            tooltip.className = config.constants.tooltipLeftClosing;

        //If it has already been deleted, cancel, if not continue
        setTimeout(function () {
            let tooltipClosing = document.querySelector(`.${config.constants.tooltipLeftClosing}`);

            if (tooltipClosing)
                tooltipClosing.remove();

            return;
        }, config.constants.animationTime);
    }

    encodeToHTML(string) {
        var ele = document.createElement("div");
        ele.innerText = string;
        return ele.innerHTML;
    }

    rgba2array(rgba) {
        //Expression gets everything between '[' and ']'.
        let regExp = /\(([^)]+)\)/;
        //[0] is with '[]' characters, and [1] is without.
        return regExp.exec(rgba)[1].split(',');
    }

    findValue(instance, searchkey) {
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
}
