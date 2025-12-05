# Overview

BrowserQL was built from the ground up to handle common challenges when accessing e-commerce or heavily monitored pages. The Bot Detection section helps you understand and overcome anti-bot measures employed by modern websites. These pages cover accessing protected pages, submitting forms without triggering bot flags, solving various types of CAPTCHAs, handling two-factor authentication, reusing sessions through cookies, and utilizing proxies for enhanced anonymity.

**Key Features:**

- Stealth Route: Use the /stealth/bql route for enhanced anti-detection
- Proxy Integration: Utilize built-in residential proxies and third-party proxies for enhanced anonymity and geographic flexibility
- CAPTCHA Solving: Built-in support for solving challenges automatically
- Fingerprint Configuration: Advanced browser fingerprint settings including browser binaries, adblock, and human-like behavior patterns

## Using a Proxy​

BrowserQL offers residential proxy support and third party proxies to successfully bypass bot detection. Proxies are a great tool for bypassing location-specific restrictions, improving stealth, and avoiding IP-based detection mechanisms.

**Proxy Options:**

- Built-in Residential Proxies: BQL includes built-in support for residential proxies, allowing you to select countries for proxy routing and configure whether to reuse the same proxy for multiple requests
- Third-Party Proxies: Support for external proxy servers with flexible configuration options for different request types
- Optimization Strategies: Use request filtering and resource rejection to minimize bandwidth consumption and reduce proxy unit usage

For detailed information on proxy configuration, optimization techniques, and advanced usage patterns, see our [Proxies documentation](https://docs.browserless.io/browserql/bot-detection/proxies).

warning

Using a proxy will consume 6 units per MB.

## Solving CAPTCHAs​

CAPTCHAs are a common roadblock in automation, but BrowserQL includes built-in support for solving various types of CAPTCHA challenges.

For detailed information on CAPTCHA solving techniques, conditional verification, and form submission after solving, see our [Solving CAPTCHAs documentation](https://docs.browserless.io/browserql/bot-detection/solving-captchas).

## Human-like Fingerprints​

BrowserQL automatically ensures a convincing fingerprint. BQL ensures your browser sessions are indistinguishable from genuine user activity. This built-in feature saves time and effort while providing top-notch stealth for your automation needs.

There are a few things that you can configure for your BQL executions, listed below.

Enterprise

For enterprise users, BQL supports M1 systems, providing high-performance browser automation on macOS devices.

### Browser Binaries​

You can select which browser you want to use, either Chromium or Chrome.
Which is the best? Well, the one that works for you!
Keep in mind that Chrome comes with codecs to render things like streamed videos, or other type of multimedia, so it is typically regarded as a more human-like browsers, however it's not a guarantee, and sometimes Chromium is the way to go!

Some detectors will block Chromium specifically, but it's more efficient to run. You have a choice of running Chrome or Chromium browsers, which you can change in the session settings.

### Adblock​

Everyone hates ads, especially humans. Using the [blockAds option](https://docs.browserless.io/browserql/launch-parameters#launch-options-query-parameters) basically means you're running an extension that blocks ads, meaning the target site will recognize that you actually have an adblocking extension installed, and this itself will change the fingerprint of your session.

### Human-like Behavior​

This will help with sites that track interactions with the website. Using this turned on will make smooth mouse behavior and human-like typing patterns, i.e. it'll make mistakes while typing, vary in speed and the mouse movements will be more erratic and human-like.

## Next Steps​

Ready to take your bot detection bypass to the next level? Explore these key areas:

[Solving CAPTCHAsHandle Cloudflare, reCAPTCHA, and a variety of others automatically with built-in support.](https://docs.browserless.io/browserql/bot-detection/solving-captchas)
[ProxiesUse residential and external proxies for enhanced anonymity and geographic flexibility.](https://docs.browserless.io/browserql/bot-detection/proxies)
[Stealthy BQLLearn more about our stealth routes for BQL](https://docs.browserless.io/browserql/bot-detection/stealth)