/**
 * @name ChannelPermissions
 * @author Farcrada
 * @version 4.2.4
 * @description Hover over channels to view their required permissions. Massive thanks to Strencher for the help.
 * 
 * @invite qH6UWCwfTu
 * @website https://github.com/Farcrada/DiscordPlugins
 * @source https://github.com/Farcrada/DiscordPlugins/blob/master/Channel-Permissions/ChannelPermissions.plugin.js
 * @updateUrl https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Channel-Permissions/ChannelPermissions.plugin.js
 */

/** @type {typeof import("react")} */
const React = BdApi.React;

const config = {
	info: {
		name: "Channel Permissions",
		id: "ChannelPermissions",
		description: "Hover over channels to view their required permissions. Massive thanks to Strencher for the help.",
		version: "4.2.4",
		author: "Farcrada",
		updateUrl: "https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Channel-Permissions/ChannelPermissions.plugin.js"
	},
	constants: {
		cssStyle: "ChannelPermissionsCSSStyle",
		textPopoutClass: "FarcradaTextPopoutClass",
		channelTooltipClass: "FarcradaChannelTooltipClass",
		syncClass: "FarcradaSyncClass",
		topicClass: "FarcradaTopicClass",
		colorAlpha: 0.6,
		popoutDelay: 250
	}
}


module.exports = class ChannelPermissions {
	//I like my spaces. 
	getName() { return config.info.name; }


	load() {
		if (!global.ZeresPluginLibrary)
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
		else
			try { global.ZeresPluginLibrary.PluginUpdater.checkForUpdate(config.info.name, config.info.version, config.info.updateUrl); }
			catch (err) { console.error(this.getName(), "Failed to reach the ZeresPluginLibrary for Plugin Updater.", err); }
	}

	start() {
		try {
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
}
.${config.constants.topicClass} > span > svg {
	transform-scale: 10%;
}`);

			//Modules for the settings
			this.TextInput = BdApi.findModule(m => m?.default?.displayName === "TextInput").default;
			this.FormStore = BdApi.findModuleByProps("FormItem");
			//Load any settings we have
			this.openingPopoutDelay = BdApi.loadData(config.info.id, "openingPopoutDelay") ?? config.constants.popoutDelay;
			this.closingPopoutDelay = BdApi.loadData(config.info.id, "closingPopoutDelay") ?? config.constants.popoutDelay;

			//Lose/single classes
			this.containerDefault = BdApi.findModuleByProps("actionIcon", "containerDefault").containerDefault;
			this.categoryContainer = BdApi.findModuleByProps("spaceBeforeCategory", "containerDefault").containerDefault;

			//Class collections
			this.roleClasses = BdApi.findModule(m => m.role && m.roleName);
			this.roleCircleClasses = BdApi.findModule(m => m.roleCircle);
			this.roleListClasses = BdApi.findModuleByProps("rolesList");
			this.popoutRootClasses = BdApi.findModuleByProps("container", "activity");
			this.popoutBodyClasses = BdApi.findModuleByProps("thin", "scrollerBase");
			this.popoutChannelActivityClasses = BdApi.findModuleByProps("channelActivityContainer", "activity");

			//Permissions
			this.PermissionStore = BdApi.findModuleByProps("Permissions", "ActivityTypes");
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

			this.StateStore = BdApi.findModuleByProps("useStateFromStoresArray");

			//Get our popout module we will patch and use
			this.ActiveThreadsPopoutModule = BdApi.findModule(m => m?.default?.displayName === "ActiveThreadsPopout");
			this.PopoutModule = BdApi.findModule(m => m?.default?.displayName === "Popout");

			//Store color converter (hex -> rgb) and d
			this.hex2rgb = BdApi.findModuleByProps("getDarkness", "isValidHex").hex2rgb;
			this.text2DiscordParser = BdApi.findModule(m => m.astParserFor && m.parse).parse;

			this.sortObject = obj => Object.keys(obj).sort().reduce((res, key) => (res[key] = obj[key], res), {});

			this.runPatches();
		}
		catch (err) {
			try {
				console.error("Attempting to stop after starting error...", err)
				this.stop();
			}
			catch (err) {
				console.error(this.getName() + ".stop()", err);
			}
		}
	}

	runPatches() {
		this.patchThreadPopout();
		this.patchVoiceActivities();
		this.patchCategoryChannel();
		this.patchTextChannel();
		this.patchVoiceChannel();
	}

	getSettingsPanel() {
		return React.createElement(this.FormStore.FormSection, null,
			React.createElement(this.FormStore.FormItem, {
				title: "Hover open delay:"
			},
				React.createElement(this.TextInput, {
					type: "number",
					defaultValue: this.openingPopoutDelay,
					onChange: (e) => {
						if (e < 0)
							return;

						BdApi.saveData(config.info.id, "openingPopoutDelay", e);
						this.openingPopoutDelay = e;
						this.runPatches();
					}
				})),
			React.createElement(this.FormStore.FormDivider, {
				style: {
					"margin-top": 10,
					"margin-bottom": 10
				}
			}),
			React.createElement(this.FormStore.FormItem, {
				title: "Hover close delay:"
			},
				React.createElement(this.FormStore.FormLabel, {}),
				React.createElement(this.TextInput, {
					type: "number",
					defaultValue: this.closingPopoutDelay,
					onChange: (e) => {
						if (e < 0)
							return;

						BdApi.saveData(config.info.id, "closingPopoutDelay", e);
						this.closingPopoutDelay = e;
						this.runPatches();
					}
				})));
	}

	stop() { BdApi.Patcher.unpatchAll(config.info.id); BdApi.clearCSS(config.constants.cssStyle); }

	patchThreadPopout() {
		//The stores we use to reference from
		const ThreadsStore = BdApi.findModuleByProps("getActiveUnjoinedThreadsForParent"),
			GuildPermissions = BdApi.findModuleByProps("getGuildPermissions"),
			//Our flux wraper
			{ useStateFromStoresArray } = this.StateStore,
			//Permission types for readability
			permissionTypes = this.PermissionStore.Permissions,
			//The functions are bound to somewhere else,
			//so to avoid breaking other things, store `this`
			self = this;


		//We fucked with the type so we need to replace this aswell.
		function useActiveThreads(channel) {
			//We don't want accidental mishaps with voice channels
			if (channel.isGuildVocal())
				return [];

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

		//After forcing the popout, we need to fill it with something
		function PatchedThreadsPopout(props) {
			//Get the neccessities from the props.
			const { children, className, channel } = props;

			if (!channel) {
				console.error("Channel is missing. Current props: ", JSON.parse(JSON.stringify(props)));
				return null;
			}
			//Return our custom popout				Ends up being: `popout-APcvZm`
			return React.createElement("div", { className: className },
				//Our tooltip
				React.createElement(self.ChannelTooltipComponent.bind(self), { key: `${config.info.id}`, channel: channel }),
				//Get the threads we can access and sort them by most recent
				useActiveThreads(channel)?.length ?
					//Null check the threads and if present append them
					children : null
			);
		}

		//Patcher McPatcherson of the existing popout function (Threads)
		BdApi.Patcher.after(config.info.id, this.ActiveThreadsPopoutModule, "default", (thisObject, methodArguments, returnValue) => {
			//Replace the type, i.e. patch the type
			returnValue.type = PatchedThreadsPopout;

			//Assign the props
			Object.assign(returnValue.props, methodArguments[0]);
		});
	}

	patchVoiceActivities() {
		//Get the module
		const VoiceChannelActivities = BdApi.findModule(m => m?.default?.displayName === "VoiceChannelActivities");

		//Patch the existing popout function (Voice activities)
		BdApi.Patcher.after(config.info.id, VoiceChannelActivities, "default", (thisObject, methodArguments, returnValue) => {
			//Set props
			const props = methodArguments[0];

			//No channel, no game
			if (!props.channel)
				return;

			//If it has a return value it means there's already something build,
			//no need to create the base again. As such, unshift it into the first position.
			if (returnValue)
				returnValue?.props?.children[2]?.unshift(
					React.createElement(
						this.ChannelTooltipComponent.bind(this), { key: `${config.info.id}`, channel: props.channel, voice: true, otherActivity: true }));
			//Otherwise, as mentioned, create the base and load the tooltip.
			else
				return React.createElement("div", { className: `${this.popoutRootClasses.container} ${this.popoutBodyClasses.thin} ${this.popoutBodyClasses.scrollerBase}` },
					React.createElement(this.ChannelTooltipComponent.bind(this), { key: `${config.info.id}`, channel: props.channel, voice: true }));
		});
	}

	async patchCategoryChannel() {
		const CategoryChannel = await global.ZeresPluginLibrary.ReactComponents.getComponent("DragSource(Component)", `.${this.categoryContainer}`, m => m.DecoratedComponent?.type);

		BdApi.Patcher.after(config.info.id, CategoryChannel?.component?.DecoratedComponent, "type", (thisObject, methodArguments, returnValue) => {
			const decendants = returnValue.props.children[0];
			returnValue.props.children[0] = React.createElement(
				this.CategoryPopoutComponent,
				{
					key: "CategoryPopoutComponent",
					popoutDelay: {
						open: this.openingPopoutDelay,
						close: config.constants.popoutDelay
					},
					decendants: decendants,
					channel: methodArguments?.[0]?.channel,
					parentProps: returnValue.props,
					modules: {
						popout: this.PopoutModule,
						activeThreads: this.ActiveThreadsPopoutModule
					}
				});
		});

		CategoryChannel.forceUpdateAll();
	}

	async patchTextChannel() {
		const TextChannel = await global.ZeresPluginLibrary.ReactComponents.getComponentByName("TextChannel", `.${this.containerDefault}`);

		//Patch mouse handling and always show popout
		BdApi.Patcher.after(config.info.id, TextChannel.component.prototype, "render", (thisObject, methodArguments, returnValue) => {
			//Make sure we can choose our delays
			//To do that we need to reconstruct
			//the existing events with our own `popoutDelay`
			const resetThreadPopoutTimers = function () {
				clearTimeout(thisObject.enterTimer);
				clearTimeout(thisObject.exitTimer);
			},
				mouseEnter = () => {
					resetThreadPopoutTimers();
					thisObject.enterTimer = setTimeout(function () {
						thisObject.setState({
							shouldShowThreadsPopout: !0
						})
					}, this.openingPopoutDelay);
				},
				mouseLeave = () => {
					resetThreadPopoutTimers();
					thisObject.exitTimer = setTimeout(function () {
						thisObject.state.shouldShowThreadsPopout && thisObject.setState({
							shouldShowThreadsPopout: !1
						})
					}, config.constants.popoutDelay);
				};


			//Transfer the events
			returnValue.props.onMouseEnter = mouseEnter;
			returnValue.props.onMouseLeave = mouseLeave;

			//Show the popout
			if (thisObject.state.shouldShowThreadsPopout)
				returnValue.props.children.props.shouldShow = true;
		});

		//For live (un)loading
		TextChannel.forceUpdateAll();
	}

	async patchVoiceChannel() {
		//Handle the functionality,
		//for that we need to patch the VoiceChannel Render
		const VoiceChannel = await global.ZeresPluginLibrary.ReactComponents.getComponentByName("VoiceChannel", `.${this.containerDefault}`);

		//Patch the handlers before since they are merely pased around.
		BdApi.Patcher.before(config.info.id, VoiceChannel.component.prototype, "render", (thisObject, methodArguments, returnValue) => {
			//Handle smooth delays
			thisObject.handleMouseEnter = () => {
				//It's got it's own smoothing but it chooses not to use it.
				//Which is fairly annoying, considering my plugin.
				thisObject.activitiesHideTimeout.stop();
				//Start a new timer with a function that should return the given execution.
				thisObject.activitiesHideTimeout.start(
					this.openingPopoutDelay,
					function () {
						//Set the state back to true, meaning it shows.
						return thisObject.setState({
							shouldShowActivities: !0
						})
					});
			};
			thisObject.handleMouseLeave = () => {
				//But when we leave we need to interrupt the current imer to show.
				//That's where `stop()` comes in.
				thisObject.activitiesHideTimeout.stop();
				//Same as above, and the times reflect those of text channels.
				thisObject.activitiesHideTimeout.start(
					this.closingPopoutDelay,
					function () {
						//Set state back to false, meaning it hides.
						return thisObject.setState({
							shouldShowActivities: !1
						})
					});
			};
		});

		//Tell it to show a popup, because we always have something.
		BdApi.Patcher.after(config.info.id, VoiceChannel.component.prototype, "render", (thisObject, methodArguments, returnValue) => {
			//Get the props of the renderpopout
			const props = this.findValue(returnValue, "renderPopout", true);
			//Show the popout
			if (thisObject.state.shouldShowActivities)
				if (props)
					props.shouldShow = true;
		});

		//For live (un)loading
		VoiceChannel.forceUpdateAll();
	}

	/**
	 * 
	 * @param {object} props React props
	 * @param {object} props.popoutDelay Hover delay
	 * @param {number} props.popoutDelay.open Delay from hovering to opening a popout
	 * @param {number} props.popoutDelay.close Delay from exiting a hover to closing a popout
	 * @param {object} props.decendants The children that have been rendered
	 * @param {object} props.channel The channel object
	 * @param {object} props.parentProps The parent's props to attach mouse events to
	 * @param {object} props.modules Component modules needed to escape the `this` scope.
	 * @param {object} props.modules.popout Popout module to instantiate a new popout component
	 * @param {object} props.modules.activeThreads Component that TextChannels use to fill a popout component
	 * @returns Popout with supplied decendants/children
	 */
	CategoryPopoutComponent(props) {
		const { popoutDelay, decendants, channel, modules } = props
		let enterTimer = 0, exitTimer = 0;

		const [shouldShow, setShouldShow] = React.useState(false),
			resetThreadPopoutTimers = () => {
				clearTimeout(enterTimer);
				clearTimeout(exitTimer)
			},
			mouseEnter = () => {
				resetThreadPopoutTimers();
				enterTimer = setTimeout(function () {
					setShouldShow(true);
				}, popoutDelay.open);
			},
			mouseLeave = () => {
				resetThreadPopoutTimers();
				exitTimer = setTimeout(function () {
					shouldShow && setShouldShow(false);
				}, popoutDelay.close);
			},
			renderThreadsPopout = (e) => {
				return React.createElement(modules.activeThreads.default,
					Object.assign({}, e, { channel }));
			},
			handleThreadsPopoutClose = () => {
				resetThreadPopoutTimers();
				setShouldShow(false);
			};

		props.parentProps.onMouseEnter = mouseEnter;
		props.parentProps.onMouseLeave = mouseLeave;

		React.useEffect(() => {
			return resetThreadPopoutTimers();
		}, []);

		return React.createElement(modules.popout.default,
			{
				position: modules.popout.default.Positions.RIGHT,
				renderPopout: renderThreadsPopout,
				onRequestClose: handleThreadsPopoutClose,
				spacing: 0,
				shouldShow: shouldShow
			},
			function () {
				return decendants;
			});
	}

	/**
	 * Constructs the tooltip itself
	 * @param {object} props React props
	 * @param {object} props.channel The channel object
	 * @param {boolean} [props.voice=false] Is the tooltip for a voice channel?
	 * @param {boolean} [props.otherActivity=false] Is there other activity expected for a voice channel?
	 * @returns React element to render
	 */
	ChannelTooltipComponent(props) {
		//Destructure all the elements from the specific channel
		const { channel, voice = false, otherActivity = false } = props;
		//Check if this channel is a (group) DM
		if (channel.isDM() || channel.isGroupDM())
			return null;

		const { allowedElements,
			deniedElements } = this.getPermissionElements(this.getGuild(channel.guild_id).roles, channel),
			//Get our channel details
			{ topic,
				categorySynced } = this.getDetails(channel),
			baseTooltip = React.createElement("div", { className: `${config.constants.channelTooltipClass}${voice ? "" : ` ${config.constants.textPopoutClass}`}`, style: { "margin-top": `${voice ? "-" : ""}8px` } }, [

				//Check if the permissions of the channel are synced with the category
				//If at all present, that is; We need to check it's type because null/undefined is not a boolean.
				typeof (categorySynced) === "string" ?
					React.createElement("div", { className: config.constants.syncClass },
						categorySynced) :
					null,

				//Start with the channel topic;
				//Check if it has a topic and regex-replace any breakage with nothing.
				topic.length > 0 ?
					React.createElement("div", null, [
						React.createElement("div", { className: this.roleListClasses.bodyTitle }, "Topic:"),
						React.createElement("div", { className: config.constants.topicClass, "viewBox": "0 0 10 10" }, topic)
					]) :
					null

				//And lastly; create and add the sections
			].concat(this.createSections(allowedElements, deniedElements)),
				React.createElement("div", { className: `${this.popoutChannelActivityClasses.activityActionsContainer}` }));

		//Set up variable for the HTML string we need to display in our tooltiptext.
		return !voice ? baseTooltip :
			!otherActivity ?
				React.createElement("div", { className: `${this.popoutRootClasses.popoutHeaderContainer}` },
					React.createElement("div", { className: `${this.popoutChannelActivityClasses.activity}` },
						React.createElement("div", { className: `${this.popoutChannelActivityClasses.channelActivityContainer}` },
							baseTooltip))) :
				React.createElement("div", { className: `${this.popoutChannelActivityClasses.activity}` },
					React.createElement("div", { className: `${this.popoutChannelActivityClasses.channelActivityContainer}` },
						baseTooltip));

	}

	/**
	 * Creates a section with the given arguments
	 * @param {string} type Type of section that is inside `elements`
	 * @param {string} title Title for this section
	 * @param {object} elements React elements to append under this title
	 * @returns React element to render
	 */
	createSection(type, title, elements, lastSection = false) {
		return elements[type] && elements[type].length > 0 ?
			React.createElement("div", null, [
				React.createElement("div", { className: this.roleListClasses.bodyTitle }, title),
				React.createElement("div", { className: `${this.roleClasses.root} ${this.roleListClasses.rolesList}`, style: lastSection ? { 'margin-bottom': `unset` } : {} }, elements[type])
			]) :
			null;
	}

	/**
	 * Wrapper function for neatness
	 * @param {object} allowedElements Object with `roles` and `users` properties that are allowed
	 * @param {object} deniedElements Object with `roles` and `users` properties that are denied
	 * @returns An array of React elements to render
	 */
	createSections(allowedElements, deniedElements) {
		let allowedRoles = this.createSection("roles", "Allowed Roles:", allowedElements),
			allowedUsers, deniedRoles, deniedUsers;

		//Scuffed logic to get the last section and make it look nice.
		//If anyone has any ideas to clean this up; hmu lmao
		if (allowedUsers = this.createSection("users", "Allowed Users:", allowedElements))
			if (deniedRoles = this.createSection("roles", "Denied Roles:", deniedElements))
				if (deniedUsers = this.createSection("users", "Denied Users:", deniedElements, true))
					; // aRoles - aUsers - dRoles - dUsers
				else
					// aRoles - aUsers - dRoles
					deniedRoles = this.createSection("roles", "Denied Roles:", deniedElements, true);
			else
				// aRoles - aUsers
				allowedUsers = this.createSection("users", "Allowed Users:", allowedElements, true);


		else
			if (deniedRoles = this.createSection("roles", "Denied Roles:", deniedElements))
				if (deniedUsers = this.createSection("users", "Denied Users:", deniedElements, true))
					;// aRoles - dRoles - dUsers
				else
					// aRoles - dRoles
					deniedRoles = this.createSection("roles", "Denied Roles:", deniedElements, true);

			else
				if (deniedUsers = this.createSection("users", "Denied Users:", deniedElements, true))
					;// aRoles - dUsers
				else
					// aRoles (which means we're overriding our start with an end version)
					allowedRoles = this.createSection("roles", "Allowed Roles:", allowedElements, true);

		return [allowedRoles, allowedUsers, deniedRoles, deniedUsers];
	}

	/**
	 * Creates a role element
	 * @param {string[]} color Array made from an RGBA colors
	 * @param {string} name Name of the subject in this element
	 * @param {boolean} [self] Is this the user themselves?
	 * @returns React element to render
	 */
	createRoleElement(color, name, self = false) {
		return React.createElement("div", { className: this.roleClasses.role, style: { "border-color": `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]})` } }, [
			React.createElement("div", { className: `${this.roleCircleClasses.roleCircle} ${this.roleCircleClasses.justifyCenter} ${this.roleCircleClasses.desaturateUserColors}`, style: { 'background-color': `rgb(${color[0]}, ${color[1]}, ${color[2]})` } }),
			//And if you have the role
			self ?
				//Add the style to strikethrough
				React.createElement("div", { 'aria-hidden': true, className: this.roleClasses.roleName, style: { "text-decoration": "line-through" } }, name) :
				//Otherwise just add as is
				React.createElement("div", { 'aria-hidden': true, className: this.roleClasses.roleName }, name)
		]);
	}

	/**
	 * Construct and get all the appropriate permissions of users and roles given the guild and channel
	 * @param {object} guildRoles Guild roles object to match against the channel
	 * @param {object} channel The channel to derive permissions of users and roles from
	 * @returns Object of allowed and denied containing `users` and `roles` react elements
	 */
	getPermissionElements(guildRoles, channel) {
		//A place to store all the results
		let allowedElements = {},
			deniedElements = {},
			everyoneDenied = false;
		//So much text, lets improve readability.
		const channelOW = this.sortObject(channel.permissionOverwrites),
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
			//Check the type of permission (allowed or denied) for viewing or connecting
			const allowedPermission = this.hasPermission(channelOW[roleID].allow, permissionTypes.VIEW_CHANNEL) ||
				this.hasPermission(channelOW[roleID].allow, permissionTypes.CONNECT),
				deniedPermission = this.hasPermission(channelOW[roleID].deny, permissionTypes.VIEW_CHANNEL) ||
					this.hasPermission(channelOW[roleID].deny, permissionTypes.CONNECT),
				//Check the type of permission (member or a role)
				permissionRole = channelOW[roleID].type === permissionOverrideTypes.ROLE ||
					overrideTypes[channelOW[roleID].type] === permissionOverrideTypes.ROLE,
				permissionMember = channelOW[roleID].type === permissionOverrideTypes.MEMBER ||
					overrideTypes[channelOW[roleID].type] === permissionOverrideTypes.MEMBER,
				//Store the current role.
				role = guildRoles[roleID];

			//Check if the current permission type is a role
			if (permissionRole) {
				//Is there a color?
				const color = role?.colorString ?
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
					if (role?.name !== "@everyone")
						//Create the element and push it through to the Allowed array
						allowedElements["roles"].push(this.createRoleElement(color, role.name, myMember?.roles.includes(roleID)));
				}
				else if (deniedPermission) {
					//If @everyone is denied set the variable to represent this.
					if (role?.name === "@everyone")
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
					color = member?.colorString ?
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
						allowedElements["users"].push(this.createRoleElement(color, user.username, member === myMember));
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
		//Check if the channel is part of a category
		if (channel.parent_id) {
			//ShowHiddenChannels plugin overwrites the parent ID if the "hidden"-categroy in settings is selected.
			//This'll need to be handled.
			let parentChannel = this.getChannel(channel.parent_id);
			if (!parentChannel)
				parentChannel = this.getChannel(this.getChannel(channel.id).parent_id)

			try {
				const parentPerms = this.sortObject(this.getPermissionsOfChannel(parentChannel)),
					channelPerms = this.sortObject(this.getPermissionsOfChannel(channel));

				//Return with topic and sync property
				return { topic: this.text2DiscordParser(channel.topic), categorySynced: `${JSON.stringify(parentPerms) === JSON.stringify(channelPerms) ? "S" : "Not s"}ynced to category` };
			} catch (err) {
				console.error("getDetails() ran into an error when getting permissions of a channel.", channel, err);
				return { topic: this.text2DiscordParser(channel.topic), categorySynced: "Category unknown." };
			}
		}
		//if not, simply return with a topic
		return { topic: this.text2DiscordParser(channel.topic) };
	}

	/**
	 * Gets every permission of a role concerning a given channel
	 * @param {object} channel The channel to get permissions from
	 * @returns All permissions of that channel per role as an object
	 */
	getPermissionsOfChannel(channel) {
		//Null check for any future issues.
		if (!channel)
			return new Error("Channel is null or undefined.");

		//Store the overwrites of the channel
		const channelOW = channel.permissionOverwrites,
			//Get Discord's permissions
			permissionTypes = this.PermissionStore.Permissions;

		//Define our return object
		let permissionObject = {};

		//Loop through all the permissions by key
		for (const roleID in channelOW) {
			for (const permType in permissionTypes) {
				//Check the type of permission (allowed or denied)
				const permAllowed = this.hasPermission(channelOW[roleID].allow, permissionTypes[permType]),
					permDenied = this.hasPermission(channelOW[roleID].deny, permissionTypes[permType]);

				//The predefining too early generates undesirable results.
				if ((permAllowed || permDenied) && !permissionObject[roleID]) {
					permissionObject[roleID] = {};
					permissionObject[roleID].name = this.getGuild(channel.guild_id)?.roles[roleID]?.name;
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
	 * @returns A string array of [R, G, B, A]
	 */
	rgba2array(rgba) {
		//Expression gets everything between '[' and ']'.
		let regExp = /\(([^)]+)\)/;
		//[0] is with '[]' characters, and [1] is without.
		return regExp.exec(rgba)[1].split(',');
	}

	/**
	 * Searches for the `searchKey` inside the `instance` object recursively
	 * @param {object} instance The instance object to search in
	 * @param {string} searchkey What key we're searching for
	 * @param {boolean} [getParentProperty] Do we want the search's parent?
	 * @returns The found object, if no matches are found, returns `undefined`
	 */
	findValue(instance, searchkey, getParentProperty = false) {
		//Where to search
		let whitelist = {
			props: true,
			children: true,
			child: true,
			sibling: true
		};
		//Where not to search
		let blacklist = {
			contextSection: true
		};

		return getKey(instance);

		function getKey(instance) {
			//In case the result is never filled, predefine it.
			let result = undefined;
			//Check if it exists
			if (instance && !Node.prototype.isPrototypeOf(instance)) {
				//Filter inherited properties
				let keys = Object.getOwnPropertyNames(instance);
				//As long as result is undefined and within keys.length; loop
				for (let i = 0; result === undefined && i < keys.length; i++) {
					let key = keys[i];

					//Make sure the property's not blacklisted
					if (key && !blacklist[key]) {
						//Cache value
						let value = instance[key];

						//if this is the key we're looking for, return it
						if (searchkey === key)
							//But if we want the property itself
							if (getParentProperty)
								//return the instance itself.
								return instance;
							else
								return value;

						//If it's an object or function (and thus searchable) and it is whitelisted
						else if ((typeof value === "object" || typeof value === "function") && whitelist[key])
							result = getKey(value);
					}
				}
			}
			return result;
		}
	}
}
