# AEGIS Invites for Facebook

Invite people who reacted to your Facebook Page posts. The on-page panel scrolls the reaction list, clicks Invite only when the button is on screen, pauses as it goes, and clears rows it has already passed so a large post stays responsive.

By Gambit Mutant, for [The AEGIS Alliance](https://theaegisalliance.com).

- [AEGIS News](https://theaegisalliance.com)
- [AEGIS Shop](https://shop.theaegisalliance.com)
- [GitHub](https://github.com/GambitMutant/aegis-invites-for-facebook)

Version 1.1.7

## What it does

- Works on facebook.com and Meta Business Suite
- Scrolls the reactions list, and the page when needed, so later invites actually load
- Clicks only Invite buttons that are in view
- Pauses for one minute after every 40 invites
- Frees photos and rows that have already scrolled past, so big posts do not get sluggish
- Stops at the run limit you set. The default is 1000

## How to use it

1. Install the extension in the browser you will use for inviting. See below.
2. Open the Facebook post, or the same post in Meta Business Suite.
3. Open the reactions list and leave that window open.
4. Use the on-page panel:
   - **Scan Current Post** invites from the post you are looking at.
   - **Start Invite Scan** walks posts on the page.
   - **Stop** ends the run.
   - **Settings** opens the options page.
   - **Max reactions this run** is the cap for this run. Leave it at 1000 unless you have a reason to change it.
5. The toolbar button opens a small popup with today’s count, the all-time count, and Settings.

You can leave the reactions window open between runs. The next run continues with the people still listed there.

## Stay within a safe pace

Meta will limit the account if invites go out too quickly, or if the browser running them looks hidden.

- Run the extension in a different browser from the one you normally use for Facebook. If you browse Facebook in your everyday browser, do the inviting in another one. That keeps a clicking limit from getting in the way of normal browsing.
- Keep at least 5–10% of that browser window visible on screen the whole time. Do not fully minimize it, and do not cover it completely.
- Leave the pause between invites at the default, about 1.5 to 4.5 seconds. In Settings those fields are the minimum and maximum delay. Make them slower if you want. Do not make them faster.
- For a large reaction list, invite about 1000 people, then wait 20 to 30 minutes before the next run. The extension already rests for one minute after every 40 invites. The longer break between runs is still worth taking.
- The default run limit is 1000. That is the number to keep.

## Install

Use the [v1.1.7 release](https://github.com/GambitMutant/aegis-invites-for-facebook/releases/tag/v1.1.7).

- Chromium browsers use `aegis-invites-facebook.zip`
- Firefox uses `aegis-invites-firefox.xpi`

Unzip the Chromium download. Load the folder that has `manifest.json` directly inside it, not the outer zip and not a nested folder.

### Chrome, Edge, Brave, Opera, and other Chromium browsers

1. Open the extensions page and turn on Developer mode.
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`
   - Opera: `opera://extensions`
2. Click **Load unpacked**.
3. Select the folder that contains `manifest.json`.

After an update, click **Reload** on the extension card. If you extracted a new folder, remove the old copy first and load the new folder.

### Firefox, and keeping it installed

Firefox is not a Chromium browser. This add-on still loads there because it uses the shared WebExtensions API. It needs Firefox 121 or newer.

**Temporary load.** `about:debugging` → This Firefox → Load Temporary Add-on removes the add-on when Firefox closes. Do not use that if you want it to stay.

**Permanent install.** Regular Firefox only keeps add-ons Mozilla has signed. This copy is not signed. Install it on Firefox Developer Edition, Nightly, or ESR:

1. Install [Firefox Developer Edition](https://www.mozilla.org/firefox/developer/), Nightly, or ESR if you are on regular Firefox.
2. Open `about:config`, accept the warning, search for `xpinstall.signatures.required`, and set it to `false`.
3. Open `about:addons`.
4. Click the gear, then **Install Add-on From File**.
5. Choose `aegis-invites-firefox.xpi` and confirm.
6. Quit Firefox completely and open it again. The add-on should still be there.

The id in the manifest is `aegis-invites@gambitmutant.github.io`. Firefox uses that id so later updates replace this same add-on instead of installing a second copy.

To update later, install the new `.xpi` the same way. You do not need to turn signature checks back on for this add-on to stay installed, but that setting applies to every unsigned add-on in that Firefox profile.

### Safari

Safari will not load the zip the way Chrome does. On a Mac, Xcode wraps the folder in a small Mac app. Running that app is what installs the extension.

1. Install Xcode from the Mac App Store. Open it once and let it finish installing the command line tools.
2. Unzip `aegis-invites-facebook.zip`. Use the folder that has `manifest.json` directly inside it.
3. Open Terminal and run this. Change the last path if your folder is somewhere else:

```
xcrun safari-web-extension-converter --macos-only --copy-resources --project-location ~/Desktop/AEGIS-Invites --app-name "AEGIS Invites" ~/Downloads/aegis-invites-facebook
```

4. Xcode should open the new project. If it does not, open the `.xcodeproj` inside `~/Desktop/AEGIS-Invites`.
5. At the top of Xcode, select the **AEGIS Invites** macOS app scheme, not the extension target by itself.
6. If signing fails, open **Signing & Capabilities** and set Team to your Apple ID. A free personal team is enough for your own Mac. Then press Run (the play button, or Command-R).
7. The wrapper app opens. Leave it running the first time. That launch registers the extension with Safari.
8. In Safari, open **Settings → Extensions**. Turn on **AEGIS Invites for Facebook** and allow it on facebook.com.
9. If it is missing from that list, the build is still unsigned. In Safari, open **Settings → Advanced** and turn on **Show features for web developers** (Safari 17 or later) or **Show Develop menu in menu bar**. Open the **Developer** tab and turn on **Allow unsigned extensions**. That checkbox resets every time you quit Safari, so turn it on again next launch. Then go back to Extensions and enable AEGIS Invites for Facebook.
10. Open a Facebook post. You should see the toolbar button and the on-page panel.

`--copy-resources` copies the files into the Xcode project. After you download a newer zip, copy the new files over the ones in that project, then run the Xcode project again.

## Donations

Donations are for The AEGIS Alliance’s project funding. A secondary purpose is business operations funding.

- [AEGIS News](https://theaegisalliance.com)
- [AEGIS Shop](https://shop.theaegisalliance.com)
- PayPal, Venmo, and Zelle: `aegisalliance`
- Cash App: `$aegisalliance`
- USDC: `0x39C7e115C4184f2E646D44E3681A87a22a93341B`
- BTC: `0x876dA7d647C37FB7A8E94Fa287FefeB192dd49fc`
- DOGE: `0x94ef8226B0409f382CAb78D2695FD3d7384f6bd6`
- ETH: `0xcD8B620962e9ff4a098c4134f1C82fDf96236F87`
- USDT: `0x4aF2eE05A313c8a8dd53EdA87DDA69F3E375c3B5`

The crypto addresses above are `0x` addresses. Send each one on the network that address belongs to. Do not send legacy Bitcoin or Dogecoin network payments to these `0x` addresses.

## A note on Facebook’s terms

Automating invites can violate Facebook’s terms and can lead to warnings or limits. Use a separate browser, keep that window partly visible, keep the default delay or slower, and take a 20 to 30 minute break after about 1000 invites.
