# Launch Parameters and Options

Browserless allows extensive configuration of how browsers are launched and behave during
your sessions. These launch parameters can be provided either via query parameters in the
URL or through a special JSON launch payload. Whether you're using BQL, BaaS v2, or REST, these
options let you tweak the browser environment to fit your needs.

## Passing Launch Options​

Two ways to specify launch options:

1. Individual Query Parameters: Add options directly to URLs (e.g., &headless=false, &proxy=residential). Best for simple boolean options.
2. Combined launch Parameter (JSON): For complex configurations, use a single query param launch with a JSON string as its value. This JSON can include any Chrome flags or Browserless-specific settings in a structured way. It's essentially the equivalent of Puppeteer's launch({ options }) but provided to the cloud service:
&launch={"headless":false,"stealth":true,"args":["--window-size=1920,1080"]}
(URL-encoded) would configure a headful, stealth-enabled browser with a specific window size.

Browserless merges both methods if used together, with individual parameters taking precedence. Use query params for simple toggles and the launch parameter for multiple settings.

## Launch Options (Query Parameters)​

Below is a list of available launch options you can use in query strings. BrowserQL
internally uses some of these, but BQL users typically set these via the IDE session settings
rather than manually in a URL.

| Parameter | Description | Default |
| --- | --- | --- |
| launch | Launch options, which contains Browserless-specific options and Chrome flags inside the args array. You can provide this as a base-64 JSON. | {} |
| token | The authorization token for API access. | none |
| timeout | Maximum session duration in milliseconds. The session will automatically close after this time to prevent overuse. | 60000 |
| headless | Runs the browser in headless mode. Set to false to enable headful mode (with a GUI). While the GUI isn't visible in cloud environments, headful mode may help bypass bot detection. Note: it uses more resources. | true |
| stealth | Enables stealth mode to reduce automation signals (similar to puppeteer-extra's stealth plugin). In BQL, stealth is always on by design and controlled via the humanlike option. In BaaS/REST, set to true to enable stealth techniques. | false (for BaaS/REST) |
| proxy | Routes browser traffic through a proxy. Only supports proxy=residential for Browserless's residential proxy pool. Omit to use the IP of the machine in the cloud running the container, meaning it's a fixed datacenter IP. | none |
| proxyCountry | Used with proxy=residential to specify the exit node's country. Accepts ISO 3166 country codes (e.g., us, gb, de). If omitted, a random location is chosen. | none |
| proxySticky | Used with proxy=residential to maintain the same proxy IP across a session (when possible). Useful for sites that expect consistent IP usage. | false |
| record | Enables session recording functionality for debugging and monitoring purposes. | false |
| humanlike | Simulates human-like behavior such as natural mouse movement, typing, and random delays. In the BQL IDE, this can be toggled in session settings. For direct BQL GraphQL calls, use humanlike: true in the launch payload. Recommended for strict bot detection scenarios. | false |
| blockAds | Enables the built-in ad blocker (powered by uBlock Origin). Helps speed up scripts and reduce noise by blocking ads and trackers. Especially useful for scraping to avoid popups and clutter. | false |
| blockConsentModals | Automatically blocks or dismisses cookie/GDPR consent banners. Available in BQL sessions and the /screenshot and /pdf REST APIs. In BQL, toggle it via the IDE or launch JSON. Useful for cleaner scraping by removing overlays. | false |
| slowMo | Adds delays between browser actions to slow down automation. Useful for debugging or bypassing rate limits. Value in milliseconds. | 0 |
| ignoreDefaultArgs | Controls which default Puppeteer/Playwright arguments to ignore when launching the browser. Can be a boolean or array of specific arguments to ignore. | false |
| acceptInsecureCerts | Accepts insecure certificates during navigation. Useful for testing sites with self-signed certificates or certificate issues. | false |

## API Reference​

For detailed API specifications and additional launch options, refer to the following API reference pages:

- Chrome BQL API: Complete API reference for Chrome BQL endpoints
- Chromium BQL API: Complete API reference for Chromium BQL endpoints

## Next Steps​

Now that you understand launch parameters and options, explore these key areas to maximize your BrowserQL automation capabilities:

[Getting Started with BQLLearn the basics of BrowserQL and how to write your first automation queries](https://docs.browserless.io/browserql/getting-started)
[Writing BQL QueriesMaster the BrowserQL language basics and learn how to write effective automation queries](https://docs.browserless.io/browserql/writing-bql/language-basics)
[Using the IDEExplore the built-in IDE features, live session preview, and development environment](https://docs.browserless.io/browserql/using-the-ide/ide-features)