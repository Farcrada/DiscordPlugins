/**
 * @name ChannelPermissions
 * 
 * @website https://github.com/Farcrada/DiscordPlugins
 * @source https://github.com/Farcrada/DiscordPlugins/blob/master/Channel-Permissions/ChannelPermissions.plugin.js
 */


class ChannelPermissions {
    getName() { return "Channel Permissions"; }
    getDescription() { return "Hover over channels to view their permissions."; }
    getVersion() { return "0.4.2"; }
    getAuthor() { return "Farcrada"; }

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

        let ToolTipStyle = document.getElementById("ToolTipStyle");
        if (ToolTipStyle) ToolTipStyle.parentElement.removeChild(ToolTipStyle);


        //LITERALLY NO IDEA WHAT THE FUCK THIS MEANS, ok maybe a little.
        BdApi.injectCSS("ToolTipStyle", `
        .tooltiptext {
            pointer-events: none;
            top: 100px;
        }

        .da-containerDefault {
            pointer-events: auto;
            position: relative;
        }
        
        .da-containerDefault .tooltiptext {
            background-color: #4c4c4c;
            border-radius: 8px;
            box-sizing: border-box;
            box-shadow: 0 1px 8px rgba(0,0,0,0.5);
            color: #cccccc;
            font-margin: 2px;
            font-size: 13px;
            font-weight: normal;
            left: 50%;
            min-width: 220px;
            opacity: 0;
            padding: 10px 10px;
            position: absolute;
            transition: opacity .5s;
            visibility: hidden;
            z-index: 99999999;
        }
        
        .da-containerUserOver .tooltiptext {
            display: none;
        }

        .da-containerDefault .above {
            top: -15%;
            transform: translate(-50%, -100%);
        }
        .da-containerDefault .under {
            top: 15%;
            transform: translate(-50%, 32px);
        }
        
        .da-containerDefault:hover .tooltiptext {
            opacity: 0.75;
            visibility: visible;
        }
        `);

        try {
            if (window.ZLibrary) this.initialize();
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
        ZLibrary.PluginUpdater.checkForUpdate(this.getName(), this.getVersion(), "https://raw.githubusercontent.com/Farcrada/DiscordPlugins/Channel-Permissions/master/ChannelPermissions.plugin.js");

        //The BdApi.find().<something>-calls gives back a class name string. In this case: "sidebar-_____ da-sidebar"
        ChannelPermissions.channelListID = "." + BdApi.findModuleByProps("container", "base").sidebar.split(" ").filter(n => n.indexOf("da-") != 0);

        //Now that we know what we're looking for we can start narrowing it down and listening for activity
        document.querySelector(ChannelPermissions.channelListID).addEventListener('mouseover', this.activateWindow);

    }

    stop() {
        //We also need to stop that activity if it's needed.
        document.querySelector(ChannelPermissions.channelListID).removeEventListener('mouseover', this.activateWindow);
    }

    activateWindow(e) {
        //We need to find something that could lead to a channelID or where you'd otherwise figure you'd want to see the permissions for channels

        //We start with the main channellist holder and target it.
        let containerdiv = e.target.closest('[class^=containerDefault]');

        //Check for null; doesn't help just continueing if we ain't got something to actually do anything with.
        if (!containerdiv)
            return;



        //Prevent "bubbling"
        let toEl = e.target;
        let fromEl = e.relatedTarget;

        //If the mouseover didn't originate at our element we can ignore it
        if (toEl != containerdiv.children[0])
            return;

        // if the element we rolled from is a child of our element we can ignore it
        while (fromEl) {
            fromEl = fromEl.parentNode;
            if (fromEl == containerdiv)
                return;
        }


        //Check if we've already got a tooltip on it, no point in adding it again if so.
        //Normally it's only got one child, so checking if it has more indicates we've fucked with it.
        //
        //This needs to be reworked seen as the tooltip falls under the message div. 
        //
        if (containerdiv.children.length > 1) {
            let toolSpan;
            if (containerdiv.children[1].classList.contains("tooltiptext"))
                toolSpan = containerdiv.children[1];
            else
                toolSpan = containerdiv.children[2];

            if (toolSpan) {
                let toolRect = toolSpan.getBoundingClientRect();
                let parentRect = containerdiv.parentElement.getBoundingClientRect();

                let relativeY = parentRect.y - toolRect.y;

                let offset = (toolSpan.offsetHeight / 100) * 30;
                let predictedYLocation = relativeY + toolSpan.offsetHeight + offset;

                if (relativeY < 0) {
                    if (!toolSpan.classList.contains("above")) {
                        //console.log("above");
                        //Need a new check to see if the height difference is caused by it being "under" the update before or not.
                        console.log({ y: relativeY, height: toolSpan.offsetHeight, predictedY: predictedYLocation, offset: offset });

                        toolSpan.classList.add("above");
                        toolSpan.classList.remove("under");
                    }
                }
                else {
                    console.log({ y: relativeY, height: toolSpan.offsetHeight, predictedY: predictedYLocation, offset: offset });
                    toolSpan.classList.add("under");
                    toolSpan.classList.remove("above");
                }

                return;
            }
        }

        //Check the internals and look for the ID to know what we're up against.
        let instance = containerdiv[Object.keys(containerdiv).find(key => key.startsWith("__reactInternal"))];
        let channelID = instance && findValue(instance, "id");

        //Once found we need the guild_id (server id) derrived from the channel hovered over
        let channel = BdApi.findModuleByProps("getChannel", "getChannels").getChannel(channelID);
        let guild = BdApi.findModuleByProps("getGuild", "getGuilds").getGuild(channel.guild_id);

        //Time to start the logic.
        let text = showRoles(guild, channel);


        function showRoles(guild, channel) {
            //Save a few calls before-hand to scour for user- and serverdata. The less; the better.
            let Permissions = BdApi.findModuleByProps("Permissions", "ActivityTypes").Permissions;
            let MemberStore = BdApi.findModuleByProps("getMember", "getMembers");
            let UserStore = BdApi.findModuleByProps("getUser", "getUsers");

            //Store yourself and preset all the display sections.
            let myMember = MemberStore.getMember(guild.id, BdApi.findModuleByProps("getCurrentUser").getCurrentUser().id);
            let allowedRoles = [], allowedUsers = [], overwrittenRoles = [], deniedRoles = [], deniedUsers = [];
            let everyoneDenied = false;

            //Loop through all the permissions
            for (let id in channel.permissionOverwrites) {
                //Check if the current permission type is a role
                if (channel.permissionOverwrites[id].type == "role" &&
                    //And if it's not just @everyopne role
                    (guild.roles[id].name != "@everyone") &&
                    //check if it's an allowing permission
                    (channel.permissionOverwrites[id].allow | Permissions.VIEW_CHANNEL) == channel.permissionOverwrites[id].allow) {

                    //Stripe through those the user has
                    if (myMember.roles.includes(id))
                        overwrittenRoles.push(guild.roles[id]);
                    //And save the rest
                    else
                        allowedRoles.push(guild.roles[id]);
                }
                //Check if permission is for a single user instead of a role
                else if (channel.permissionOverwrites[id].type == "member" &&
                    //check if it's an allowing permission
                    (channel.permissionOverwrites[id].allow | Permissions.VIEW_CHANNEL) == channel.permissionOverwrites[id].allow) {

                    //Specific allowed users get added to their own section
                    let user = UserStore.getUser(id);
                    let member = MemberStore.getMember(guild.id, id);
                    if (user && member)
                        allowedUsers.push(Object.assign({ name: user.username }, member));
                }
                //Same as the allowed but now for denied roles
                if (channel.permissionOverwrites[id].type == "role" &&
                    (channel.permissionOverwrites[id].deny | Permissions.VIEW_CHANNEL) == channel.permissionOverwrites[id].deny) {

                    //Specific everyone denied
                    deniedRoles.push(guild.roles[id]);
                    //If @everyone is denied set the variable to represent this.
                    if (guild.roles[id].name == "@everyone")
                        everyoneDenied = true;
                }
                //Same as the allowed but now for denied members
                else if (channel.permissionOverwrites[id].type == "member" &&
                    (channel.permissionOverwrites[id].deny | Permissions.VIEW_CHANNEL) == channel.permissionOverwrites[id].deny) {

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
            let FlexChild = BdApi.findModuleByProps("flexChild", "flex");
            let TextSize = BdApi.findModuleByProps("size10", "size14", "size20");
            let TextStyle = BdApi.findModuleByProps("large", "primary", "selectable");
            //Set up variable for the HTML string we need to display in our tooltiptext.
            let htmlString = ``;

            //Start with the channel topic;
            //Check if it has a topic and regex-replace any breakage with nothing.

            /// Deleted
            //${UserPopout.marginBottom4}
            //
            //
            //          

            if (channel.topic && channel.topic.replace(/[\t\n\r\s]/g, "")) {
                htmlString += `<div class="">Topic:</div><div class=""><div class="${Role.role + FlexChild.flex + Role.alignCenter + Role.wrap + TextSize.size12 + TextStyle.weightMedium} SHC-topic" style="border-color: rgba(255, 255, 255, 0.6); height: unset !important; padding-top: 5px; padding-bottom: 5px; max-width: ${window.outerWidth / 3}px">${encodeToHTML(channel.topic)}</div></div>`;
            }
            //The allowed roles, and thus the overwritten roles (those the user already has)
            if (allowedRoles.length > 0 || overwrittenRoles.length > 0) {
                //Title
                htmlString += `<div class="">Allowed Roles:</div><div class="">`;
                //Loop through the allowed roles
                for (let role of allowedRoles) {
                    let color = role.colorString ? colorCONVERT(role.colorString, "RGBCOMP") : [255, 255, 255];
                    htmlString += `<div class="${Role.role + FlexChild.flex + Role.alignCenter + Role.wrap + TextSize.size12 + TextStyle.weightMedium} SHC-allowedrole" style="border-color: rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.6);"><div class="${Role.roleCircle}" style="background-color: rgb(${color[0]}, ${color[1]}, ${color[2]});"></div><div class="${Role.roleName}">${encodeToHTML(role.name)}</div></div>`;
                }
                //loop through the overwritten roles
                for (let role of overwrittenRoles) {
                    let color = role.colorString ? colorCONVERT(role.colorString, "RGBCOMP") : [255, 255, 255];
                    htmlString += `<div class="${Role.role + FlexChild.flex + Role.alignCenter + Role.wrap + TextSize.size12 + TextStyle.weightMedium} SHC-overwrittenrole" style="border-color: rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.6);"><div class="${Role.roleCircle}" style="background-color: rgb(${color[0]}, ${color[1]}, ${color[2]});"></div><div class="${Role.roleName}" style="text-decoration: line-through !important;">${encodeToHTML(role.name)}</div></div>`;
                }
                //And it with a /div.
                htmlString += `</div>`;
            }
            //Check for allowed users
            if (allowedUsers.length > 0) {
                //Title
                htmlString += `<div class="">Allowed Users:</div><div class="">`;
                //Loop throught it
                for (let user of allowedUsers) {
                    let color = user.colorString ? colorCONVERT(user.colorString, "RGBCOMP") : [255, 255, 255];
                    htmlString += `<div class="${Role.role + FlexChild.flex + Role.alignCenter + Role.wrap + TextSize.size12 + TextStyle.weightMedium} SHC-denieduser" style="border-color: rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.6);"><div class="${Role.roleCircle}" style="background-color: rgb(${color[0]}, ${color[1]}, ${color[2]});"></div><div class="${Role.roleName}">${encodeToHTML(user.nick ? user.nick : user.name)}</div></div>`;
                }
                //End it.
                htmlString += `</div>`;
            }
            //Check for denied roles
            if (deniedRoles.length > 0) {
                //Title
                htmlString += `<div class="">Denied Roles:</div><div class="">`;
                //Loop throught it
                for (let role of deniedRoles) {
                    let color = role.colorString ? colorCONVERT(role.colorString, "RGBCOMP") : [255, 255, 255];
                    htmlString += `<div class="${Role.role + FlexChild.flex + Role.alignCenter + Role.wrap + TextSize.size12 + TextStyle.weightMedium} SHC-deniedrole" style="border-color: rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.6);"><div class="${Role.roleCircle}" style="background-color: rgb(${color[0]}, ${color[1]}, ${color[2]});"></div><div class="${Role.roleName}">${encodeToHTML(role.name)}</div></div>`;
                }
                //End it.
                htmlString += `</div>`;
            }
            //Check for denied users
            if (deniedUsers.length > 0) {
                //Title
                htmlString += `<div class="">Denied Users:</div><div class="">`;
                //Loop through it.
                for (let user of deniedUsers) {
                    let color = user.colorString ? colorCONVERT(user.colorString, "RGBCOMP") : [255, 255, 255];
                    htmlString += `<div class="${Role.role + FlexChild.flex + Role.alignCenter + Role.wrap + TextSize.size12 + TextStyle.weightMedium} SHC-denieduser" style="border-color: rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.6);"><div class="${Role.roleCircle}" style="background-color: rgb(${color[0]}, ${color[1]}, ${color[2]});"></div><div class="${Role.roleName}">${encodeToHTML(user.nick ? user.nick : user.name)}</div></div>`;
                }
                //End it.
                htmlString += `</div>`;
            }
            //If we have anything we need to create the tooltip.
            if (htmlString)
                //This'll daisychain return the constructed <span>
                return createTooltip(htmlString);
            else
                //And if it fucked up we got nothing.
                return undefined;
        }

        function createTooltip(text) {
            //Create <span> object
            let toolTipElementSpan = document.createElement("span");

            //Add classname for CSS (we start with transition to have it register)
            toolTipElementSpan.classList.add("tooltiptext")
            toolTipElementSpan.classList.add("above")

            //Insert our magnificent text
            toolTipElementSpan.innerHTML = text;

            //Add our tooltip style to the container and append the span.
            containerdiv.appendChild(toolTipElementSpan);

            //End it with a return of made object.
            return toolTipElementSpan;
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
                child: true,
                channel: true
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
    }
}
