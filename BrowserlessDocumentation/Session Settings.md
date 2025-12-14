# Session Settings

BrowserQL Editor allows you to have multiple sessions, each with their own particular configurations. For example, you can have a first section running on chrome, with human-like behavior active, while the second one runs on chromium, without human-like behavior, and with a proxy.

## Configuring Session Settings​

Session Settings allows you to configure the following for each individual tab in the editor:

- Browser: Choose which browser the session will use. Either Chromium or Chrome. Some websites require certain codecs to be supported. Typically sites that require streaming such as Twitch, will let you know that "browser is not currently supported" - that's a good time to test a different browser binary. If you're using the default path, you're using Chromium. Adding /chrome/bql path to your endpoint will switch to the Chrome binaries that might support the site. The browser now also supports Chromium Stealth mode, which is recommended for solving CAPTCHAs and bypassing Cloudflare protection. Use the /stealth/bql path to enable stealth mode.
- Human-like Behavior: Select whether the automation should imitate human behavior, including smooth mouse movements and typing patterns that resemble those of a person.
- Viewport Mode / Viewport Size: Configure a fixed viewport size to ensure CSS styling remains consistent across all executions. This prevents layout shifts and ensures your automation scripts interact with elements at predictable positions. Set a specific width and height (e.g., 1920x1080) to maintain the same viewport dimensions throughout your session.
- Adblock: Toggle adblock on/off in the session. Useful for accessing websites cluttered with intrusive ads, improving page readability, reducing distractions, and speeding up data scraping workflows.
- Block Consent Modals: Block cookie consent and similar popups automatically in the session.
- Residential Proxy: Route the browser's requests through a residential proxy network. This enhances anonymity and mimics real user traffic, making it ideal for accessing geographically restricted content or bypassing anti-bot measures. Note that this will significantly increase unit consumption. Refer to the Using a Proxy guide for more details.
- Sticky Proxy: (Available when Residential Proxy is enabled) Forward the browser's requests through the same IP address for the duration of the session.
- Proxy Country: (Available when Residential Proxy is enabled) Select the country you wish to proxy requests from.

Different Results Between IDE and API Calls?

**This is the #1 cause of inconsistent behavior.** The [Export Query as Code](https://docs.browserless.io/browserql/using-the-ide/ide-features#export-query-as-code) feature ensures your API calls use the exact same settings as your IDE, eliminating configuration mismatches that cause different results.

Below shows how to configure different session settings, where:

### First Session

- Browser: Chrome
- Human-like Behavior: On
- Adblock: On
- Residential Proxy: Off

### Second Session

- Browser: Chromium
- Human-like Behavior: Off
- Adblock: Off
- Residential Proxy: On

Your browser does not support the video tag.

## Next Steps​

Explore these key features to enhance your browser automation:

[Using API CallsLearn how to integrate BrowserQL with your applications and export queries to code](https://docs.browserless.io/browserql/using-the-ide/using-api-calls)
[Writing Your First QueryStart creating BrowserQL automation scripts with step-by-step guidance](https://docs.browserless.io/browserql/writing-bql/language-basics)
[Bot DetectionMaster advanced techniques to bypass anti-bot measures and access protected sites](https://docs.browserless.io/browserql/bot-detection/overview)