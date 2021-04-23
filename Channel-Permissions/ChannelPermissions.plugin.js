/**
 * @name ChannelPermissions
 * 
 * @website https://github.com/Farcrada/DiscordPlugins
 * @source https://github.com/Farcrada/DiscordPlugins/blob/master/Channel-Permissions/ChannelPermissions.plugin.js
 */


class ChannelPermissions {
    getName() { return "Channel Permissions"; }
    getDescription() { return "Hover over channels to view their permissions."; }
    getVersion() { return "3.1.0"; }
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

        let channelPermissionCSS = document.querySelector('#ChannelPermissionCSS');
        if (channelPermissionCSS)
            channelPermissionCSS.remove();

        BdApi.injectCSS("ChannelPermissionCSS", `
        @keyframes tooltipFadeIn {
            from {
                opacity: 0.98;
                transform: scale(0.9875);
            }
          
            to {
                opacity: 1;
                transform: scale(1);
            }
        }

        .toolTipToolTip {
            transform-origin: left center;
            animation: tooltipFadeIn 0.15s;
            width: 300px;
        }`);
    }

    //If everything is ok; "after" start()
    initialize() {
        global.ZeresPluginLibrary.PluginUpdater.checkForUpdate(this.getName(), this.getVersion(), "https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Channel-Permissions/ChannelPermissions.plugin.js");

        //Now that we know what we're looking for we can start narrowing it down and listening for activity
        document.querySelector(`.${BdApi.findModuleByProps("container", "base").sidebar}`).addEventListener('mouseover', this.createToolTip);

    }

    stop() {
        //We also need to stop that activity if it's needed.
        document.querySelector(`.${BdApi.findModuleByProps("container", "base").sidebar}`).removeEventListener('mouseover', this.createToolTip);
    }

    createToolTip(e) {
        //We start with the main channellist holder and target it.
        let container = e.target.closest('[class|=containerDefault]');
        //Halt if there's nothing present.
        if (!container)
            return;

        //Check the internals and look for the Channel property which contains the channel's ID.
        let instance = container[Object.keys(container).find(key => key.startsWith("__reactInternal"))];
        let instanceChannel = instance && findValue(instance, "channel");

        //This is what happens when consistency isn't upheld 
        if (!instanceChannel) {
            //Since the previous search was fruitless, we need to make it an object
            instanceChannel = {};
            //Then search /RELIABLY/ for the channel ID and 
            instanceChannel.id = (instance && findValue(instance, "data-list-item-id")).replace(/[^0-9]/g, '');
        }

        //Once found we need the guild_id (server id) derrived from the channel hovered over
        let ChannelStore = BdApi.findModuleByProps("getChannel", "getDMFromUserId");
        let channel = ChannelStore.getChannel(instanceChannel.id);
        let guild = BdApi.findModuleByProps("getGuild", "getGuilds").getGuild(channel.guild_id);

        //Time to start the logic.
        //This returns the actual <div> which is made.
        let contentHTML = showRoles(guild, channel);
        //console.log(contentHTML);

        container.onmouseenter = function () { toolTipOnMouseEnter(container, contentHTML); };
        container.onmouseleave = toolTipOnMouseLeave;

        function showRoles(guild, channel) {
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
                    //check if it's an allowing permission
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
                    //check if it's an allowing permission
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

            //The only logical assumption if @everyone isn't allowed.
            if (!everyoneDenied)
                allowedRoles.push({ "name": "@everyone" });

            //Scour the api some more for styles.
            let Role = BdApi.findModuleByProps("roleCircle", "roleName", "roleRemoveIcon");
            let RoleList = BdApi.findModuleByProps("rolesList");

            //Set up variable for the HTML string we need to display in our tooltiptext.
            let htmlString = `<div class = "${RoleList.bodyInnerWrapper}">`;

            //Start with the channel topic;
            //Check if it has a topic and regex-replace any breakage with nothing.
            if (channel.topic && channel.topic.replace(/[\t\n\r\s]/g, ""))
                htmlString += `<div class="${RoleList.bodyTitle}">
                        Topic:
                    </div>
                    <div class="${RoleList.note}">
                        <div class="${BdApi.findModuleByProps("textarea").textarea} ${BdApi.findModuleByProps("scrollbar").scrollbarGhostHairline}" style="display:inline-block;">
                            ${channel.topic}
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
                    let color = role.colorString ? colorCONVERT(role.colorString, "RGBCOMP") : [255, 255, 255];
                    htmlString += `<div class="${Role.role}" style="border-color: rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.6);">
                            <div class="${Role.roleCircle}" style="background-color: rgb(${color[0]}, ${color[1]}, ${color[2]});">
                            </div>
                            <div aria-hidden="true" class="${Role.roleName}">
                                ${encodeToHTML(role.name)}
                            </div>
                        </div>`;
                }

                //loop through the overwritten roles
                for (let role of overwrittenRoles) {
                    let color = role.colorString ? colorCONVERT(role.colorString, "RGBCOMP") : [255, 255, 255];
                    htmlString += `<div class="${Role.role}" style="border-color: rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.6);">
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
                    let color = user.colorString ? colorCONVERT(user.colorString, "RGBCOMP") : [255, 255, 255];
                    htmlString += `<div class="${Role.role}" style="border-color: rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.6);">
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
            //Check for denied roles
            if (deniedRoles.length > 0) {
                //Title
                htmlString += `<div class="${RoleList.bodyTitle}">
                        Denied Roles:
                    </div>
                    <div class="${Role.root} ${RoleList.rolesList} ${RoleList.endBodySection}">`;

                //Loop throught it
                for (let role of deniedRoles) {
                    let color = role.colorString ? colorCONVERT(role.colorString, "RGBCOMP") : [255, 255, 255];
                    htmlString += `<div class="${Role.role}" style="border-color: rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.6);">
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
                    let color = user.colorString ? colorCONVERT(user.colorString, "RGBCOMP") : [255, 255, 255];
                    htmlString += `<div class="${Role.role}" style="border-color: rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.6);">
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
    }
}

function toolTipOnMouseEnter(container, contentHTML) {
    let wrapper = document.createElement('div');
    let layer = BdApi.findModuleByProps("layer");
    let tooltip = BdApi.findModuleByProps("tooltip");
    let listItemTooltip = BdApi.findModuleByProps("listItemTooltip").listItemTooltip;
    
    wrapper.innerHTML = `<div class='${layer.layer} ${layer.disabledPointerEvents} toolTipToolTip'>
        <div class="${tooltip.tooltip} ${tooltip.tooltipRight} ${tooltip.tooltipPrimary} ${tooltip.tooltipDisablePointerEvents} ${listItemTooltip}">
            <div class="${tooltip.tooltipPointer}">
            </div>
            <div class="${tooltip.tooltipContent}">
                ${contentHTML}
            </div>
        </div>
    </div>`;

    //This is so fkn scuffed. I need a better solution for this.
    document.querySelector(`#app-mount > .${layer.layerContainer}`).appendChild(wrapper.firstChild);

    wrapper = document.querySelector('.toolTipToolTip');

    let containerRight = parseInt(container.getBoundingClientRect().right);
    let containerTop = parseInt(container.getBoundingClientRect().top) + (container.offsetHeight * 0.5) - (wrapper.offsetHeight * 0.5);
    wrapper.style = `position: absolute; top: ${containerTop.toString()}px; left: ${containerRight.toString()}px;`;
}

function toolTipOnMouseLeave() {
    document.querySelector('.toolTipToolTip').remove();
}

/////////////////////////////////////////////////////////
//////                                             //////
//////  Just functions you need, nothing special   //////
//////                                             //////
///////////////////////////////////////////////////////// 

function colorCONVERT(color, conv, type) {
    if (isObject(color)) {
        var newcolor = {};
        for (let pos in color) newcolor[pos] = colorCONVERT(color[pos], conv, type);
        return newcolor;
    }
    else {
        type = type === undefined || !type || !["RGB", "RGBA", "RGBCOMP", "HSL", "HSLA", "HSLCOMP", "HEX", "HEXA", "INT"].includes(type.toUpperCase()) ? getColorType(color) : type.toUpperCase();
        if (conv == "RGBCOMP") {
            switch (type) {
                case "RGBCOMP":
                    if (color.length == 3) return processRGB(color);
                    else if (color.length == 4) {
                        let a = processA(color.pop());
                        return processRGB(color).concat(a);
                    }
                    break;
                case "RGB":
                    return processRGB(color.replace(/\s/g, "").slice(4, -1).split(","));
                case "RGBA":
                    let comp = color.replace(/\s/g, "").slice(5, -1).split(",");
                    let a = processA(comp.pop());
                    return processRGB(comp).concat(a);
                case "HSLCOMP":
                    if (color.length == 3) return colorCONVERT(`hsl(${processHSL(color).join(",")})`, "RGBCOMP");
                    else if (color.length == 4) {
                        let a = processA(color.pop());
                        return colorCONVERT(`hsl(${processHSL(color).join(",")})`, "RGBCOMP").concat(a);
                    }
                    break;
                case "HSL":
                    var hslcomp = processHSL(color.replace(/\s/g, "").slice(4, -1).split(","));
                    var r, g, b, m, c, x, p, q;
                    var h = hslcomp[0] / 360, l = parseInt(hslcomp[1]) / 100, s = parseInt(hslcomp[2]) / 100; m = Math.floor(h * 6); c = h * 6 - m; x = s * (1 - l); p = s * (1 - c * l); q = s * (1 - (1 - c) * l);
                    switch (m % 6) {
                        case 0: r = s, g = q, b = x; break;
                        case 1: r = p, g = s, b = x; break;
                        case 2: r = x, g = s, b = q; break; 7
                        case 3: r = x, g = p, b = s; break;
                        case 4: r = q, g = x, b = s; break;
                        case 5: r = s, g = x, b = p; break;
                    }
                    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
                case "HSLA":
                    var hslcomp = color.replace(/\s/g, "").slice(5, -1).split(",");
                    return colorCONVERT(`hsl(${hslcomp.slice(0, 3).join(",")})`, "RGBCOMP").concat(processA(hslcomp.pop()));
                case "HEX":
                    var hex = /^#([a-f\d]{1})([a-f\d]{1})([a-f\d]{1})$|^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
                    return [parseInt(hex[1] + hex[1] || hex[4], 16).toString(), parseInt(hex[2] + hex[2] || hex[5], 16).toString(), parseInt(hex[3] + hex[3] || hex[6], 16).toString()];
                case "HEXA":
                    var hex = /^#([a-f\d]{1})([a-f\d]{1})([a-f\d]{1})([a-f\d]{1})$|^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
                    return [parseInt(hex[1] + hex[1] || hex[5], 16).toString(), parseInt(hex[2] + hex[2] || hex[6], 16).toString(), parseInt(hex[3] + hex[3] || hex[7], 16).toString(), Math.floor(mapRange([0, 255], [0, 100], parseInt(hex[4] + hex[4] || hex[8], 16).toString())) / 100];
                case "INT":
                    color = processINT(color);
                    return [(color >> 16 & 255).toString(), (color >> 8 & 255).toString(), (color & 255).toString()];
                default:
                    return null;
            }
        }
        else {
            var rgbcomp = type == "RGBCOMP" ? color : colorCONVERT(color, "RGBCOMP", type);
            if (rgbcomp) switch (conv) {
                case "RGB":
                    return `rgb(${processRGB(rgbcomp.slice(0, 3)).join(",")})`;
                case "RGBA":
                    rgbcomp = rgbcomp.slice(0, 4);
                    var a = rgbcomp.length == 4 ? processA(rgbcomp.pop()) : 1;
                    return `rgba(${processRGB(rgbcomp).concat(a).join(",")})`;
                case "HSLCOMP":
                    var a = rgbcomp.length == 4 ? processA(rgbcomp.pop()) : null;
                    var hslcomp = processHSL(colorCONVERT(rgbcomp, "HSL").replace(/\s/g, "").split(","));
                    return a != null ? hslcomp.concat(a) : hslcomp;
                case "HSL":
                    var r = processC(rgbcomp[0]), g = processC(rgbcomp[1]), b = processC(rgbcomp[2]);
                    var max = Math.max(r, g, b), min = Math.min(r, g, b), dif = max - min, h, l = max === 0 ? 0 : dif / max, s = max / 255;
                    switch (max) {
                        case min: h = 0; break;
                        case r: h = g - b + dif * (g < b ? 6 : 0); h /= 6 * dif; break;
                        case g: h = b - r + dif * 2; h /= 6 * dif; break;
                        case b: h = r - g + dif * 4; h /= 6 * dif; break;
                    }
                    return `hsl(${processHSL([Math.round(h * 360), l * 100, s * 100]).join(",")})`;
                case "HSLA":
                    var j0 = rgbcomp.length == 4 ? processA(rgbcomp.pop()) : 1;
                    return `hsla(${colorCONVERT(rgbcomp, "HSL").slice(4, -1).split(",").concat(j0).join(",")})`;
                case "HEX":
                    return ("#" + (0x1000000 + (rgbcomp[2] | rgbcomp[1] << 8 | rgbcomp[0] << 16)).toString(16).slice(1)).toUpperCase();
                case "HEXA":
                    return ("#" + (0x1000000 + (rgbcomp[2] | rgbcomp[1] << 8 | rgbcomp[0] << 16)).toString(16).slice(1) + (0x100 + Math.round(mapRange([0, 100], [0, 255], processA(rgbcomp[3]) * 100))).toString(16).slice(1)).toUpperCase();
                case "INT":
                    return processINT(rgbcomp[2] | rgbcomp[1] << 8 | rgbcomp[0] << 16);
                default:
                    return null;
            }
        }
    }
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

function getColorType(color) {
    if (color != null) {
        if (typeof color === "object" && (color.length == 3 || color.length == 4)) {
            if (isRGB(color)) return "RGBCOMP";
            else if (isHSL(color)) return "HSLCOMP";
        }
        else if (typeof color === "string") {
            if (/^#[a-f\d]{3}$|^#[a-f\d]{6}$/i.test(color)) return "HEX";
            else if (/^#[a-f\d]{4}$|^#[a-f\d]{8}$/i.test(color)) return "HEXA";
            else {
                color = color.toUpperCase();
                var comp = color.replace(/[^0-9\.\-\,\%]/g, "").split(",");
                if (color.indexOf("RGB(") == 0 && comp.length == 3 && isRGB(comp)) return "RGB";
                else if (color.indexOf("RGBA(") == 0 && comp.length == 4 && isRGB(comp)) return "RGBA";
                else if (color.indexOf("HSL(") == 0 && comp.length == 3 && isHSL(comp)) return "HSL";
                else if (color.indexOf("HSLA(") == 0 && comp.length == 4 && isHSL(comp)) return "HSLA";
            }
        }
        else if (typeof color === "number" && parseInt(color) == color && color > -1 && color < 16777216) return "INT";
    }
    return null;
    function isRGB(comp) { return comp.slice(0, 3).every(rgb => rgb.toString().indexOf("%") == -1 && parseFloat(rgb) == parseInt(rgb)); };
    function isHSL(comp) { return comp.slice(1, 3).every(hsl => hsl.toString().indexOf("%") == hsl.length - 1); };
}

function mapRange(from, to, value) {
    if (parseFloat(value) < parseFloat(from[0])) return parseFloat(to[0]);
    else if (parseFloat(value) > parseFloat(from[1])) return parseFloat(to[1]);
    else return parseFloat(to[0]) + (parseFloat(value) - parseFloat(from[0])) * (parseFloat(to[1]) - parseFloat(to[0])) / (parseFloat(from[1]) - parseFloat(from[0]));
}

function encodeToHTML(string) {
    var ele = document.createElement("div");
    ele.innerText = string;
    return ele.innerHTML;
}

function processRGB(comp) { return comp.map(c => { return processC(c); }); };
function isObject(obj) { return obj && Object.prototype.isPrototypeOf(obj) && !Array.prototype.isPrototypeOf(obj); }
