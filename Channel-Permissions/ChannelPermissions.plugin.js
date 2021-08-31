/**
 * @name ChannelPermissions
 * @author Farcrada
 * @version 3.7.4
 * @description Hover over channels to view their required permissions.
 * 
 * @invite qH6UWCwfTu
 * @website https://github.com/Farcrada/DiscordPlugins
 * @source https://github.com/Farcrada/DiscordPlugins/blob/master/Channel-Permissions/ChannelPermissions.plugin.js
 * @updateUrl https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Channel-Permissions/ChannelPermissions.plugin.js
 *
 * Massive thanks to Strencher for getting me familiar with functional components
 * and getting me in the right direction.
 *  <3
 */


const config = {
	info: {
		name: "Channel Permissions",
		id: "ChannelPermissions",
		description: "Hover over channels to view their required permissions.",
		version: "3.7.4",
		author: "Farcrada and loads of thanks to Strencher",
		updateUrl: "https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Channel-Permissions/ChannelPermissions.plugin.js"
	},
	constants: {
		cssStyle: "ChannelPermissionsCSSStyle",
		textPopoutClass: "FarcradaTextPopoutClass",
		channelTooltipClass: "FarcradaChannelTooltipClass",
		syncClass: "FarcradaSyncClass",
		topicClass: "FarcradaTopicClass",
		colorAlpha: 0.6
	}
}


class ChannelPermissions {
	//I like my spaces. 
	getName() { return config.info.name; }

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

	initialize() {
		//Inject our styles
		BdApi.injectCSS(config.constants.cssStyle, `
.${config.constants.textPopoutClass} {
	padding: 0 4px;
}
.${config.constants.channelTooltipClass} {
	color: var(--interactive-active);
}
.${config.constants.syncClass} {
	display: inline-block;
	font-size: 10px;
	margin-bottom: 6px;
}
.${config.constants.topicClass} {
	display: inline-block;
	overflow-wrap: anywhere;
	font-size: 12px;
	margin-bottom: 10px;
}`);
		//Create and cache expensive `BdApi.findModule` calls.

		//Lose/single classes
		this.containerDefault = BdApi.findModuleByProps("containerDefault", "containerDragAfter").containerDefault;

		//Class collections
		this.roleClasses = BdApi.findModuleByProps("roleCircle", "roleName", "roleRemoveIcon");
		this.roleListClasses = BdApi.findModuleByProps("rolesList");
		this.popoutRootClasses = BdApi.findModuleByProps("container", "activity");
		this.popoutBodyClasses = BdApi.findModuleByProps("thin", "scrollerBase");

		//Permissions
		this.PermissionStore = BdApi.findModuleByProps("Permissions", "ActivityTypes");
		this.PermissionUtilityStore = BdApi.findModuleByProps("computePermissionsForRoles");
		this.hasPermission = BdApi.findModuleByProps("deserialize", "invert", "has").has;

		//Cache the function, makes it easier.
		//We can't make these methods cleanly because that would make a `findModule` call.
		this.getGuild = BdApi.findModuleByProps("getGuild", "getGuilds").getGuild;
		this.getChannel = BdApi.findModuleByProps("getChannel", "getDMFromUserId").getChannel;
		this.getMember = BdApi.findModuleByProps("getMember", "getMembers").getMember;
		//Set local store and get the functions we need.
		const UserStore = BdApi.findModuleByProps("getUser", "getUsers");
		this.getUser = UserStore.getUser;
		this.getCurrentUser = UserStore.getCurrentUser;
		//Store color converter (hex -> rgb) and d
		this.hex2rgb = BdApi.findModuleByProps("getDarkness", "isValidHex").hex2rgb;
		this.useStateFromStoresArray = BdApi.findModuleByProps("useStateFromStoresArray").useStateFromStoresArray;


		//New way of doing things
		//Thank you Strencher
		this.patchTextChannel();
		this.patchVoiceChannel();
		this.patchThreadChannel();
	}

	stop() { BdApi.Patcher.unpatchAll(config.info.id); BdApi.clearCSS(config.constants.cssStyle); }

	async patchTextChannel() {
		const TextChannel = await global.ZeresPluginLibrary.ReactComponents.getComponentByName("TextChannel", `.${this.containerDefault}`);

		BdApi.Patcher.after(config.info.id, TextChannel.component.prototype, "render", (thisObject, methodArguments, returnValue) => {
			//Transfer the events
			returnValue.props.onMouseEnter = thisObject.handleMouseEnter;
			returnValue.props.onMouseLeave = thisObject.handleMouseLeave;
			//Show the popout
			if (thisObject.state.shouldShowThreadsPopout)
				returnValue.props.children.props.shouldShow = true;
		});

		TextChannel.forceUpdateAll();
	}

	async patchVoiceChannel() {
		//VoiceChannelActivities
		//Get the module
		const VoiceChannelActivities = BdApi.findModule(m => m?.default?.displayName === "VoiceChannelActivities");

		BdApi.Patcher.after(config.info.id, VoiceChannelActivities, "default", (thisObject, methodArguments, returnValue) => {
			//Set props
			const props = methodArguments[0];

			//No channel, no game
			if (!props.channel)
				return;

			//If it has a return value it means there's already something build,
			//no need to create the base again. As such, unshift it into the first position.
			if (returnValue)
				returnValue.props.children.unshift(this.ChannelTooltip(props.channel, true));
			//Otherwise, as mentioned, create the base and load the tooltip.
			else
				return BdApi.React.createElement("div", { className: `${this.popoutRootClasses.container} ${this.popoutBodyClasses.thin}` }, this.ChannelTooltip(props.channel, true));
		});

		//Handle the functionality,
		//for that we need to patch the VoiceChannel Render
		const VoiceChannel = await global.ZeresPluginLibrary.ReactComponents.getComponentByName("VoiceChannel", `.${this.containerDefault}`);

		BdApi.Patcher.after(config.info.id, VoiceChannel.component.prototype, "render", (thisObject, methodArguments, returnValue) => {
			//Get the props of the renderpopout
			const props = global.ZeresPluginLibrary.Utilities.findInReactTree(returnValue, e => e?.renderPopout);

			//Transfer the events
			returnValue.props.onMouseEnter = thisObject.handleMouseEnter;
			returnValue.props.onMouseLeave = thisObject.handleMouseLeave;
			//Show the popout
			if (thisObject.state.shouldShowActivities) {
				if (props) props.shouldShow = true;
			}
		});
	}

	patchThreadChannel() {
		//Get our popout module we will patch
		const ActiveThreadsPopout = BdApi.findModule(m => m?.default?.displayName === "ActiveThreadsPopout"),
			//The stores we use to reference from
			ThreadsStore = BdApi.findModuleByProps("getActiveUnjoinedThreadsForParent"),
			GuildPermissions = BdApi.findModuleByProps("getGuildPermissions"),
			//Our flux wraper
			{ useStateFromStoresArray } = BdApi.findModuleByProps("useStateFromStoresArray"),
			//Permission types for readability
			permissionTypes = this.PermissionStore.Permissions,
			//The functions are bound to somewhere else,
			//so to avoid breaking other things, store `this`
			self = this;


		function useActiveThreads(channel) {
			//We don't want accidental mishaps with voice channels
			if (channel.isVocal())
				return [];

			function compare(first, second) {
				//No difference
				if (first === second)
					return 0;
				//The first one is bigger
				else if (null == second ||
					first.length > second.length ||
					first > second)
					return 1;
				//If it isn't equal and the first isn't bigger, the second must be.
				else
					return -1;
			}

			//This is a react hook married with flux
			//We use this to cache the stores and limit our resource consumption,
			//also enables us to update without having to call a `forceUpdate` on the owner
			//As a result it can then also store the result and only needs to rerun when the stores have changed
			return useStateFromStoresArray([ThreadsStore, GuildPermissions], () => {
				//Get all the threads of the current channel
				return Object.values(ThreadsStore.getActiveUnjoinedThreadsForParent(channel.guild_id, channel.id))
					//Filter those we cannot view
					.filter(thread => GuildPermissions.can(permissionTypes.VIEW_CHANNEL, thread));
			});
		}

		function PatchedThreadsPopout(props) {
			//Get the neccessities from the props.
			const { children, className, channel } = props,
				//Get the threads we can access and sort them by most recent
				threads = useActiveThreads(channel);

			//Return our custom popout				Ends up being: `popout-APcvZm`
			return BdApi.React.createElement("div", { className: className },
				//Our tooltip
				self.ChannelTooltip(channel),
				//Null check the threads and if present append them
				threads && threads.length ? children : null
			);
		};

		//Patcher McPatcherson
		BdApi.Patcher.after(config.info.id, ActiveThreadsPopout, "default", (thisObject, methodArguments, returnValue) => {
			//Replace the type, i.e. patch the type
			returnValue.type = PatchedThreadsPopout;
			//Assign the props
			Object.assign(returnValue.props, methodArguments[0]);
		});
	}

	/**
	 * Constructs the tooltip itself
	 * @param {object} channel The channel object
	 * @param {boolean} voice Is the tooltip for avoice channel?
	 * @returns React render object.
	 */
	ChannelTooltip(channel, voice = false) {
		//Destructure all the elements from the specific channel
		const { allowedElements,
			deniedElements } = this.getPermissionElements(this.getGuild(channel.guild_id).roles, channel),
			//Get our channel details
			{ topic,
				categorySynced } = this.getDetails(channel);

		//Set up variable for the HTML string we need to display in our tooltiptext.
		return BdApi.React.createElement("div", { className: `${config.constants.channelTooltipClass}${voice ? "" : ` ${config.constants.textPopoutClass}`}`, style: { "margin-top": `${voice ? "-" : ""}8px` } }, [

			//Check if the permissions of the channel are synced with the category
			//If at all present, that is; We need to check it's type because null/undefined is not a boolean.
			typeof (categorySynced) === "boolean" ?
				BdApi.React.createElement("div", { className: config.constants.syncClass },
					`${categorySynced ? "S" : "Not s"}ynced to category`) :
				null,

			//Start with the channel topic;
			//Check if it has a topic and regex-replace any breakage with nothing.
			topic && topic.replace(/[\t\n\r\s]/g, "") ?
				BdApi.React.createElement("div", null, [
					BdApi.React.createElement("div", { className: this.roleListClasses.bodyTitle }, "Topic:"),
					BdApi.React.createElement("div", { className: config.constants.topicClass }, topic)
				]) :
				null

			//And lastly; create and add the sections
		].concat(this.createSections(allowedElements, deniedElements)));
	}

	/**
	 * Creates a section with the given arguments
	 * @param {*} type Type of section
	 * @param {*} title Title for this section
	 * @param {object} elements React elements to append under this title
	 * @returns 
	 */
	createSection(type, title, elements) {
		return elements[type] && elements[type].length > 0 ?
			BdApi.React.createElement("div", null, [
				BdApi.React.createElement("div", { className: this.roleListClasses.bodyTitle }, title),
				BdApi.React.createElement("div", { className: `${this.roleClasses.root} ${this.roleListClasses.rolesList} ${this.roleListClasses.endBodySection}` }, elements[type])
			]) :
			null;
	}

	/**
	 * Wrapper function for neatness
	 * @param {object} allowedElements Object with `roles` and `users` properties that are allowed
	 * @param {object} deniedElements Object with `roles` and `users` properties that are denied
	 * @returns An array of React elements to render.
	 */
	createSections(allowedElements, deniedElements) {
		return [
			this.createSection("roles", "Allowed Roles:", allowedElements),
			this.createSection("users", "Allowed Users:", allowedElements),
			this.createSection("roles", "Denied Roles:", deniedElements),
			this.createSection("users", "Denied Users:", deniedElements)
		];
	}

	/**
	 * Creates a role element
	 * @param {Array} color Array made from an RGBA colors.
	 * @param {*} name Name of the subject in this element.
	 * @param {*} self Is this the user themselves?
	 * @returns React element to render
	 */
	createRoleElement(color, name, self = false) {
		return BdApi.React.createElement("div", { className: this.roleClasses.role, style: { "border-color": `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]})` } }, [
			BdApi.React.createElement("div", { className: this.roleClasses.roleCircle, style: { 'background-color': `rgb(${color[0]}, ${color[1]}, ${color[2]})` } }),
			//And if you have the role
			self ?
				//Add the style to strikethrough
				BdApi.React.createElement("div", { 'aria-hidden': true, className: this.roleClasses.roleName, style: { "text-decoration": "line-through" } }, name) :
				//Otherwise just add as is
				BdApi.React.createElement("div", { 'aria-hidden': true, className: this.roleClasses.roleName }, name)
		]);
	}

	/**
	 * Construct and get all the appropriate permissions of users and roles given the guild and channel
	 * @param {Array} guildRoles Array of guild roles to match against the channel
	 * @param {*} channel The channel to derive permissions of users and roles from
	 * @returns Object of allowed and denied containing `users` and `roles` react elements
	 */
	getPermissionElements(guildRoles, channel) {
		//A place to store all the results
		let allowedElements = {},
			deniedElements = {},
			everyoneDenied = false;

		//So much text, lets improve readability.
		const channelOW = channel.permissionOverwrites,
			//Permission overrides
			permissionOverrideTypes = this.PermissionStore.PermissionOverrideType,
			//Permissions
			permissionTypes = this.PermissionStore.Permissions,
			//Store yourself
			myMember = this.getMember(channel.guild_id, this.getCurrentUser().id),
			//Get the override types (array of two; ROLE and MEMBER)
			overrideTypes = Object.keys(permissionOverrideTypes),
			//Set white color for everyone role
			colorWhite = [255, 255, 255, config.constants.colorAlpha];


		//Loop through all the permissions by key
		for (const roleID in channelOW) {
			//Check if it's an ALLOWING permission via bitwise OR
			const allowedPermission = this.hasPermission(channelOW[roleID].allow, permissionTypes.VIEW_CHANNEL) ||
				//For viewing or connecting
				this.hasPermission(channelOW[roleID].allow, permissionTypes.CONNECT),
				//Check if it's an DENYING permission via bitwise OR
				deniedPermission = this.hasPermission(channelOW[roleID].deny, permissionTypes.VIEW_CHANNEL) ||
					//For viewing or connecting
					this.hasPermission(channelOW[roleID].deny, permissionTypes.CONNECT),
				//Check the type of permission
				permissionRole = channelOW[roleID].type === permissionOverrideTypes.ROLE ||
					overrideTypes[channelOW[roleID].type] === permissionOverrideTypes.ROLE,
				//Same but for a single member.
				permissionMember = channelOW[roleID].type === permissionOverrideTypes.MEMBER ||
					overrideTypes[channelOW[roleID].type] === permissionOverrideTypes.MEMBER,
				role = guildRoles[roleID];

			//Check if the current permission type is a role
			if (permissionRole) {
				//Is there a color?
				const color = role.colorString ?
					//Convert it to our style
					this.rgba2array(this.hex2rgb(role.colorString, config.constants.colorAlpha)) :
					//Otherwise make it white
					colorWhite;

				//Predefine our arrays
				if (!allowedElements["roles"])
					allowedElements["roles"] = [];
				if (!deniedElements["roles"])
					deniedElements["roles"] = [];

				if (allowedPermission) {
					//And if it's not just @everyone role
					if (role && role.name !== "@everyone")
						//Create the element and push it through to the Allowed array
						allowedElements["roles"].push(this.createRoleElement(color, role.name, myMember.roles.includes(roleID)));
				}
				else if (deniedPermission) {
					//If @everyone is denied set the variable to represent this.
					if (role && role.name === "@everyone")
						//Specific everyone denied
						everyoneDenied = true;

					//Create the element and push it through to the Denied array
					deniedElements["roles"].push(this.createRoleElement(color, role.name));
				}
			}
			//Check if permission is for a single user instead of a role
			else if (permissionMember) {
				//Specific allowed users get added to their own section
				const user = this.getUser(roleID),
					member = this.getMember(channel.guild_id, roleID),
					//Is there a color?
					color = member && member.colorString ?
						//Convert it to our style
						this.rgba2array(this.hex2rgb(member.colorString, config.constants.colorAlpha)) :
						//Otherwise make it white
						colorWhite

				//Predefine our arrays
				if (!allowedElements["users"])
					allowedElements["users"] = [];
				if (!deniedElements["users"])
					deniedElements["users"] = [];

				if (user && member)
					if (allowedPermission)
						allowedElements["users"].push(this.createRoleElement(color, user.username));
					else if (deniedPermission)
						deniedElements["users"].push(this.createRoleElement(color, user.username));
			}
		}

		//The only logical assumption if @everyone isn't denied.
		if (!everyoneDenied) {
			if (!allowedElements["roles"])
				allowedElements["roles"] = [];
			allowedElements["roles"].push(this.createRoleElement(colorWhite, "@everyone", true));
		}

		return { allowedElements, deniedElements };
	}

	/**
	 * Gets the topic and if it's synced with the category or not (if applicable) of the channel
	 * @param {object} channel The channel to get the topic and check if they are synced with the category (if applicable)
	 * @returns A details object containing the channel topic and if it's synced with the category or not (if applicable)
	 */
	getDetails(channel) {
		//A category doesn't have a topic so we can simply return as is.
		if (channel.isCategory())
			return null;
		else {
			//Check if the channel is part of a category
			if (!channel.parent_id)
				//if not, simply return with a topic
				return { topic: channel.topic };

			const parentPerms = this.getPermissionsOfChannel(this.getChannel(channel.parent_id)),
				channelPerms = this.getPermissionsOfChannel(channel);

			//Return with topic and sync property
			return { topic: channel.topic, categorySynced: JSON.stringify(parentPerms) === JSON.stringify(channelPerms) };
		}
	}

	/**
	 * Gets every permission of a role concerning a given channel
	 * @param {object} channel The channel to get permissions from.
	 * @returns All permissions of that channel per role as an object
	 */
	getPermissionsOfChannel(channel) {
		//Store the overwrites of the channel
		const channelOW = channel.permissionOverwrites,
			//Get Discord's permissions
			permissionTypes = this.PermissionStore.Permissions;

		//Define our return object
		let permissionObject = {};

		//Loop through all the permissions by key
		for (const roleID in channelOW) {
			for (const permType in permissionTypes) {
				//Check if the permission is allowed via bitwise AND
				const permAllowed = this.hasPermission(channelOW[roleID].allow, permissionTypes[permType]),
					//Check if the permission is denied via bitwise AND
					permDenied = this.hasPermission(channelOW[roleID].deny, permissionTypes[permType]);

				//The predefining too early generates undesirable results.
				if ((permAllowed || permDenied) && !permissionObject[roleID]) {
					permissionObject[roleID] = {};
					permissionObject[roleID].name = this.getGuild(channel.guild_id).roles[roleID]?.name;
				}

				//Sort the types between allowed and denied
				if (permAllowed)
					permissionObject[roleID][permType] = true;
				if (permDenied)
					permissionObject[roleID][permType] = false;
			}
		}
		//Return our findings
		return permissionObject;
	}

	/**
	 * Convert RGBA value into an array for better use.
	 * @param {string} rgba The color string 
	 * @returns An array of R, G, B, A
	 */
	rgba2array(rgba) {
		//Expression gets everything between '[' and ']'.
		let regExp = /\(([^)]+)\)/;
		//[0] is with '[]' characters, and [1] is without.
		return regExp.exec(rgba)[1].split(',');
	}
}
