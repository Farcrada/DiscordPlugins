/**
 * @name ChannelPermissions
 * @author Farcrada
 * @version 3.3.4
 * @description Hover over channels to view their required permissions.
 * 
 * @website https://github.com/Farcrada/DiscordPlugins
 * @source https://github.com/Farcrada/DiscordPlugins/blob/master/Channel-Permissions/ChannelPermissions.plugin.js
 * @updateUrl https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Channel-Permissions/ChannelPermissions.plugin.js
 */


class ChannelPermissions {
    getName() { return "Channel Permissions"; }
    getDescription() { return "Hover over channels to view their required permissions."; }
    getVersion() { return "3.3.4"; }
    getAuthor() { return "Farcrada"; }

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

    //If everything is ok; "after" start()
    initialize() {
        global.ZeresPluginLibrary.PluginUpdater.checkForUpdate(this.getName(), this.getVersion(), "https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Channel-Permissions/ChannelPermissions.plugin.js");

        //Now that we know what we're looking for we can start narrowing it down and listening for activity
        document.querySelector(`.${BdApi.findModuleByProps("container", "base").sidebar}`).addEventListener('mouseover', this.createToolTip);

        checkRemoveCSS();

        BdApi.injectCSS("FarcradaTooltipCSS", `
        @keyframes FarcradaTooltipCSSFadeIn {
            from {
                opacity: 0;
                transform: scale(0.95);
            }
        }
        
        @keyframes FarcradaTooltipCSSFadeOut {
            to {
                opacity: 0;
                transform: scale(0.95);
            }
        }

        .FarcradaTooltipLeft {
            transform-origin: left center;
            animation: FarcradaTooltipCSSFadeIn 0.1s;
            width: 300px;
        }
        
        .FarcradaTooltipLeftClosing {
            transform-origin: left center;
            animation: FarcradaTooltipCSSFadeOut 0.1s;
            width: 300px;
        }`);
    }

    stop() {
        //We also need to stop that activity if it's needed.
        document.querySelector(`.${BdApi.findModuleByProps("container", "base").sidebar}`).removeEventListener('mouseover', this.createToolTip);

        checkRemoveCSS();
    }

    createToolTip(e) {
        //We start with the main channellist holder and target it.
        let container = e.target.closest('[class|=containerDefault]');
        //Halt if there's nothing present.
        if (!container)
            return;

        //Check the internals and look for the Channel property which contains the channel's ID.
        let instance = container[Object.keys(container).find(key => key.startsWith("__reactInternal"))];
        let instanceChannel = findValue(instance, "channel");

        //This is what happens when consistency isn't upheld 
        if (!instanceChannel) {
            //Since the previous search was fruitless, we need to make it an object
            instanceChannel = {};
            //Then search /RELIABLY/ for the channel ID and 
            instanceChannel.id = findValue(instance, "data-list-item-id").replace(/[^0-9]/g, '');
        }

        //Once found we need the guild_id (server id) derrived from the channel hovered over
        let ChannelStore = BdApi.findModuleByProps("getChannel", "getDMFromUserId");
        let channel = ChannelStore.getChannel(instanceChannel.id);
        let guild = BdApi.findModuleByProps("getGuild", "getGuilds").getGuild(channel.guild_id);

        //Time to start the logic.
        //This returns the actual <div> which is made.
        let contentHTML = constructToolTipContent(getRoles(guild, channel));

        //Attach events to actually make it work.
        container.onmouseenter = function () { toolTipOnMouseEnter(container, contentHTML); };
        container.onmouseleave = toolTipOnMouseLeave;
    }
}

//Check for exisitng CSS, and remove it.
function checkRemoveCSS() {
    let FarcradaTooltipCSS = document.querySelector('#FarcradaTooltipCSS');
    if (FarcradaTooltipCSS)
        FarcradaTooltipCSS.remove();
}

//Construct the tooltip's content from the given roles.
function constructToolTipContent(channelRolesAndTopic) {
    //Destructure all the allowed roles from the specific channel
    let { allowedRoles, allowedUsers, overwrittenRoles, deniedRoles, deniedUsers, topic } = channelRolesAndTopic;

    //Scour the api some more for styles.
    let Role = BdApi.findModuleByProps("roleCircle", "roleName", "roleRemoveIcon");
    let RoleList = BdApi.findModuleByProps("rolesList");
    //Store color converter (hex -> rgb) and define global alpha.
    let ColorConvert = BdApi.findModuleByProps("getDarkness", "isValidHex");
    let colorAlpha = 0.6;

    //Set up variable for the HTML string we need to display in our tooltiptext.
    let htmlString = `<div class = "${RoleList.bodyInnerWrapper}">`;

    //Start with the channel topic;
    //Check if it has a topic and regex-replace any breakage with nothing.
    if (topic && topic.replace(/[\t\n\r\s]/g, ""))
        htmlString += `<div class="${RoleList.bodyTitle}">
                        Topic:
                    </div>
                    <div class="${RoleList.note}">
                        <div class="${BdApi.findModuleByProps("textarea").textarea} ${BdApi.findModuleByProps("scrollbar").scrollbarGhostHairline}" style="display:inline-block;">
                            ${topic}
                        </div>
                    </div>`;

    //The allowed roles, and thus the overwritten roles (those the user already has)
    if (allowedRoles.length > 0 || overwrittenRoles.length > 0) {
        //Title
        htmlString += `<div class="${RoleList.bodyTitle}">
                        Allowed Roles:
                    </div>
                    <div class="${Role.root} ${RoleList.rolesList} ${RoleList.endBodySection}">`;

        //Loop through the allowed roles
        for (let role of allowedRoles) {
            let color = role.colorString ? rgba2array(ColorConvert.hex2rgb(role.colorString, colorAlpha)) : [255, 255, 255, colorAlpha];
            htmlString += `<div class="${Role.role}" style="border-color: rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]});">
                            <div class="${Role.roleCircle}" style="background-color: rgb(${color[0]}, ${color[1]}, ${color[2]});">
                            </div>
                            <div aria-hidden="true" class="${Role.roleName}">
                                ${encodeToHTML(role.name)}
                            </div>
                        </div>`;
        }

        //Loop through the overwritten roles
        for (let role of overwrittenRoles) {
            let color = role.colorString ? rgba2array(ColorConvert.hex2rgb(role.colorString, colorAlpha)) : [255, 255, 255, colorAlpha];
            htmlString += `<div class="${Role.role}" style="border-color: rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]});">
                            <div class="${Role.roleCircle}" style="background-color: rgb(${color[0]}, ${color[1]}, ${color[2]});">
                            </div>
                            <div aria-hidden="true" class="${Role.roleName}" style="text-decoration: line-through !important;">
                                ${encodeToHTML(role.name)}
                            </div>
                        </div>`;
        }

        //End it with a /div.
        htmlString += `</div>`;
    }
    //Check for allowed users
    if (allowedUsers.length > 0) {
        //Title
        htmlString += `<div class="${RoleList.bodyTitle}">
                        Allowed Users:
                    </div>
                    <div class="${Role.root} ${RoleList.rolesList} ${RoleList.endBodySection}">`;

        //Loop throught it
        for (let user of allowedUsers) {
            let color = user.colorString ? ColorConvert.hex2rgb(user.colorString, colorAlpha) : `rgba(255, 255, 255, ${colorAlpha})`;
            htmlString += `<div class="${Role.role}" style="border-color: ${color};">
                            <div class="${Role.roleCircle}" style="background-color: ${color};">
                            </div>
                            <div class="${Role.roleName}">
                                ${encodeToHTML(user.nick ? user.nick : user.name)}
                            </div>
                        </div>`;
        }

        //End it.
        htmlString += `</div>`;
    }
    //Check for denied roles
    if (deniedRoles.length > 0) {
        //Title
        htmlString += `<div class="${RoleList.bodyTitle}">
                        Denied Roles:
                    </div>
                    <div class="${Role.root} ${RoleList.rolesList} ${RoleList.endBodySection}">`;

        //Loop throught it
        for (let role of deniedRoles) {
            let color = role.colorString ? rgba2array(ColorConvert.hex2rgb(role.colorString, colorAlpha)) : [255, 255, 255, colorAlpha];
            htmlString += `<div class="${Role.role}" style="border-color: rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]});">
                            <div class="${Role.roleCircle}" style="background-color: rgb(${color[0]}, ${color[1]}, ${color[2]});">
                            </div>
                            <div class="${Role.roleName}">
                                ${encodeToHTML(role.name)}
                            </div>
                        </div>`;
        }

        //End it.
        htmlString += `</div>`;
    }
    //Check for denied users
    if (deniedUsers.length > 0) {
        //Title
        htmlString += `<div class="${RoleList.bodyTitle}">
                        Denied Users:
                    </div>
                    <div class="${Role.root} ${RoleList.rolesList} ${RoleList.endBodySection}">`;

        //Loop through it.
        for (let user of deniedUsers) {
            let color = user.colorString ? rgba2array(ColorConvert.hex2rgb(user.colorString, colorAlpha)) : [255, 255, 255, colorAlpha];
            htmlString += `<div class="${Role.role}" style="border-color: rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]});">
                            <div class="${Role.roleCircle}" style="background-color: rgb(${color[0]}, ${color[1]}, ${color[2]});">
                            </div>
                            <div class="${Role.roleName}">
                                ${encodeToHTML(user.nick ? user.nick : user.name)}
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
function getRoles(guild, channel) {
    //Save a few calls before-hand to scour for user- and serverdata. The less; the better.
    let PermissionStore = BdApi.findModuleByProps("Permissions", "ActivityTypes");
    let MemberStore = BdApi.findModuleByProps("getMember", "getMembers");
    let UserStore = BdApi.findModuleByProps("getUser", "getUsers");

    let overrideTypes = Object.keys(PermissionStore.PermissionOverrideType);

    //Store yourself and create all the role sections.
    let myMember = MemberStore.getMember(guild.id, BdApi.findModuleByProps("getCurrentUser").getCurrentUser().id);
    let allowedRoles = [], allowedUsers = [], overwrittenRoles = [], deniedRoles = [], deniedUsers = [];
    let everyoneDenied = false;

    //Loop through all the permissions
    for (let id in channel.permissionOverwrites) {
        //Check if the current permission type is a role
        if ((channel.permissionOverwrites[id].type == PermissionStore.PermissionOverrideType.ROLE || overrideTypes[channel.permissionOverwrites[id].type] == PermissionStore.PermissionOverrideType.ROLE) &&
            //And if it's not just @everyopne role
            (guild.roles[id] && guild.roles[id].name != "@everyone") &&
            //Check if it's an allowing permission
            ((channel.permissionOverwrites[id].allow | PermissionStore.Permissions.VIEW_CHANNEL) == channel.permissionOverwrites[id].allow || (channel.permissionOverwrites[id].allow | PermissionStore.Permissions.CONNECT) == channel.permissionOverwrites[id].allow)) {

            //Stripe through those the user has
            if (myMember.roles.includes(id))
                overwrittenRoles.push(guild.roles[id]);
            //And save the rest
            else
                allowedRoles.push(guild.roles[id]);
        }
        //Check if permission is for a single user instead of a role
        else if ((channel.permissionOverwrites[id].type == PermissionStore.PermissionOverrideType.MEMBER || overrideTypes[channel.permissionOverwrites[id].type] == PermissionStore.PermissionOverrideType.MEMBER) &&
            //Check if it's an allowing permission
            ((channel.permissionOverwrites[id].allow | PermissionStore.Permissions.VIEW_CHANNEL) == channel.permissionOverwrites[id].allow || (channel.permissionOverwrites[id].allow | PermissionStore.Permissions.CONNECT) == channel.permissionOverwrites[id].allow)) {

            //Specific allowed users get added to their own section
            let user = UserStore.getUser(id);
            let member = MemberStore.getMember(guild.id, id);

            if (user && member)
                allowedUsers.push(Object.assign({ name: user.username }, member));
        }
        //Same as the allowed but now for denied roles
        if ((channel.permissionOverwrites[id].type == PermissionStore.PermissionOverrideType.ROLE || overrideTypes[channel.permissionOverwrites[id].type] == PermissionStore.PermissionOverrideType.ROLE) &&
            ((channel.permissionOverwrites[id].deny | PermissionStore.Permissions.VIEW_CHANNEL) == channel.permissionOverwrites[id].deny || (channel.permissionOverwrites[id].deny | PermissionStore.Permissions.CONNECT) == channel.permissionOverwrites[id].deny)) {

            //Specific everyone denied
            deniedRoles.push(guild.roles[id]);

            //If @everyone is denied set the variable to represent this.
            if (guild.roles[id].name == "@everyone")
                everyoneDenied = true;
        }
        //Same as the allowed but now for denied members
        else if ((channel.permissionOverwrites[id].type == PermissionStore.PermissionOverrideType.MEMBER || overrideTypes[channel.permissionOverwrites[id].type] == PermissionStore.PermissionOverrideType.MEMBER) &&
            ((channel.permissionOverwrites[id].deny | PermissionStore.Permissions.VIEW_CHANNEL) == channel.permissionOverwrites[id].deny || (channel.permissionOverwrites[id].deny | PermissionStore.Permissions.CONNECT) == channel.permissionOverwrites[id].deny)) {

            //Specific denied users
            let user = UserStore.getUser(id);
            let member = MemberStore.getMember(guild.id, id);

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
function toolTipOnMouseEnter(container, contentHTML) {
    //Destroy other closing elements to make sure it doesn't look weird.
    let closingTooltip = document.querySelector('.FarcradaTooltipLeftClosing')
    if (closingTooltip)
        closingTooltip.remove();

    //The wrapper
    let wrapper = document.createElement('div');
    //Native tooltip classnames for CSS
    let layerClasses = BdApi.findModuleByProps("layer");
    let tooltipClasses = BdApi.findModuleByProps("tooltip");
    let listItemTooltipClass = BdApi.findModuleByProps("listItemTooltip").listItemTooltip;

    //Construct the tooltip.
    wrapper.innerHTML = `<div class='${layerClasses.layer} ${layerClasses.disabledPointerEvents} FarcradaTooltipLeft'>
        <div class="${tooltipClasses.tooltip} ${tooltipClasses.tooltipRight} ${tooltipClasses.tooltipPrimary} ${tooltipClasses.tooltipDisablePointerEvents} ${listItemTooltipClass}">
            <div class="${tooltipClasses.tooltipPointer}">
            </div>
            <div class="${tooltipClasses.tooltipContent}">
                ${contentHTML}
            </div>
        </div>
    </div>`;

    //This is so fkn scuffed. I need a better solution for this.
    document.querySelector(`#app-mount > .${layerClasses.layerContainer}`).appendChild(wrapper.firstChild);
    //But oh well.
    let tooltipElement = document.querySelector('.FarcradaTooltipLeft');

    //Get the box centered and next to the channel.
    let containerRight = parseInt(container.getBoundingClientRect().right);
    let containerTop = parseInt(container.getBoundingClientRect().top) + (container.offsetHeight * 0.5) - (tooltipElement.offsetHeight * 0.5);
    tooltipElement.style = `position: absolute; top: ${containerTop.toString()}px; left: ${(containerRight + 10).toString()}px;`;
}

//Event for when the mouse leaves the channel
function toolTipOnMouseLeave() {
    //Acquire the element, initiate the removal
    document.querySelector('.FarcradaTooltipLeft').className = "FarcradaTooltipLeftClosing";

    //If it has already been deleted, cancel, if not continue
    setTimeout(function () {
        let tooltip = document.querySelector('.FarcradaTooltipLeftClosing');

        if (tooltip)
            tooltip.remove();

        return;
    }, 100);
}

function findValue(instance, searchkey) {
    var whitelist = {
        memoizedProps: true,
        child: true
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

function encodeToHTML(string) {
    var ele = document.createElement("div");
    ele.innerText = string;
    return ele.innerHTML;
}

function rgba2array(rgba) {
    let regExp = /\(([^)]+)\)/;
    return regExp.exec(rgba)[1].split(',');
}
