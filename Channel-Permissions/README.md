# Channel-Permissions
Show what permissions are required for channels by hovering over them. Inspired by and new/updated version of [DevilBro (Mirco Wittrien)'s original](https://github.com/mwittrien/BetterDiscordAddons/tree/master/Plugins/ShowHiddenChannels) from the earlier days. Functionality is still in the original but not the experience.

## Latest update:
It has been a while since I last messed with this and I have since worked hard to bring a reliable experience. I feel I have now brought it to a good stable state, and would like to share this actually working experience.

## What's fixed?
- Everything, it just works now.
Ok, well, almost everything.

- It should draw way less resources.
I switched from mouse activity to indexing to lessen the resource use. For someone constantly switching channels it might be negligible (if we were to suppose it worked as intended before (it didn't)) but when you just have it it is worth the optimization. Although mouse activity is still used, it is now contained within the objects individually.

## What's left to fix?
- There is a fix to be had where opening a category means it has not been indexed and thus will not show any tool-tips.
To fix this simply switch text channels to re-index everything.
- Code optimizations.
But what doesn't need optimizations.
