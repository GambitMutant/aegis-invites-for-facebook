# AEGIS Invites for Facebook

https://github.com/GambitMutant

Invite people who reacted to your Facebook Page posts.

- Scrolls the reaction list and only clicks Invite buttons that are actually on screen
- Pauses for one minute after every 40 invites
- Drops reaction rows and their photos after they scroll past so large posts stay responsive
- Run limit field, default 1000
- Settings opens from the on-page panel

Version 1.1.4

## Install
Same extension for Chromium, Safari, and Firefox. Firefox is not Chromium. It loads this build because the extension uses the shared WebExtensions API (`chrome` or `browser`).

### Chrome, Edge, Brave, Opera, and other Chromium browsers
1. Open the extensions page and turn on Developer mode
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`
   - Opera: `opera://extensions`
2. Choose Load unpacked and select the folder that contains `manifest.json`

### Firefox, and it stays installed
`about:debugging` → Load Temporary Add-on is removed when Firefox closes. Do not use that if you want it to remain.

Regular Firefox only keeps add-ons Mozilla has signed. This copy is not signed. Install it permanently on Firefox Developer Edition, Nightly, or ESR:

1. Install Firefox Developer Edition, Nightly, or ESR if you are on regular Firefox.
2. Open `about:config`, accept the warning, find `xpinstall.signatures.required`, and set it to false.
3. Open `about:addons`.
4. Click the gear, then Install Add-on From File, and choose `aegis-invites-firefox.xpi`.
5. Confirm the install. Quit Firefox and open it again. The add-on is still there.

The id in the manifest is `aegis-invites@gambitmutant.github.io`. Firefox uses that id to keep the same add-on across updates.

### Safari converter
Safari will not load this zip the way Chrome does. On a Mac, Xcode wraps the folder in a small Mac app, and running that app installs the extension.

1. Install Xcode from the Mac App Store, then open it once so it finishes installing the command line tools.
2. Unzip `aegis-invites-facebook.zip`. Use the folder that has `manifest.json` directly inside it.
3. Open Terminal and run this, replacing the path with your folder:

```
xcrun safari-web-extension-converter --macos-only --copy-resources --project-location ~/Desktop/AEGIS-Invites --app-name "AEGIS Invites" ~/Downloads/aegis-invites-facebook
```

4. When it finishes, it opens an Xcode project. If it does not, open the `.xcodeproj` inside `~/Desktop/AEGIS-Invites`.
5. In the project, select the AEGIS Invites macOS app scheme at the top, not the extension target alone.
6. If Xcode says signing failed, open Signing & Capabilities, set Team to your Apple ID (a free personal team is enough for your own Mac), then press Run (the play button, or Command-R).
7. The wrapper app launches. Leave it running the first time. That launch is what registers the extension with Safari.
8. In Safari, choose Settings, then Extensions. Turn on AEGIS Invites for Facebook. When Safari asks, allow it on facebook.com.
9. If the extension is missing from that list, the build is still unsigned. Choose Safari, then Settings, then Advanced, and turn on Show features for web developers (Safari 17 or later) or Show Develop menu in menu bar. Then open the Developer tab and turn on Allow unsigned extensions. That checkbox resets every time you quit Safari, so turn it on again next launch. Go back to Extensions and enable AEGIS Invites for Facebook.
10. Open a Facebook post. The toolbar button and the on-page panel are the extension.

Run the Xcode project again after you replace the extension files. `--copy-resources` copies them into the project, so copy the new files over the ones inside the Xcode project before you run it again.

On Facebook, use the panel. Open Settings to change limits.

Use responsibly. Automation may violate Facebook's terms.