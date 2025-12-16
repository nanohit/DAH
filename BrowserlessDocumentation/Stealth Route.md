# Stealth Route

BrowserQL's stealth route provides advanced anti-detection capabilities specifically optimized for our BQL tool. This route combines BrowserQL's powerful automation features with comprehensive browser fingerprint mitigations and entropy injection for maximum effectiveness against bot detection systems.

## Available Stealth Route​

- Stealth Route (Recommended) - /stealth/bql
Our recommended stealth route for BrowserQL users. This managed stealth environment provides advanced anti-detection and realistic fingerprinting with comprehensive browser fingerprint mitigations and entropy injection for maximum effectiveness against bot detection systems.

## Using the Stealth Route​

To use the stealth route with BrowserQL, you can select the Stealth browser in the [BQL IDE settings](https://account.browserless.io/bql/), or when running programmatically, simply specify the stealth endpoint:

```
# Stealth (Recommended)curl -X POST \  https://production-sfo.browserless.io/stealth/bql?token=YOUR_API_TOKEN_HERE \  -H 'Content-Type: application/json' \  -d '{    "query": "query { goto(url: \"https://example.com\") { status } }"  }'
```

## Additional Bot Detection Strategies​

To further enhance your ability to bypass bot detection with BrowserQL:

- Use Residential Proxies: Many sites monitor IP addresses and may block data-center IPs or enforce rate limits. BrowserQL supports built-in residential proxies with country selection and proxy reuse options. For setup details, see our Proxies documentation.
- Enable Human-like Behavior: Configure mouse movements and typing patterns to appear more natural and human-like.
- Block Ads: Using ad-blocking can make your sessions appear more like real users, as most humans use ad blockers.
- Advanced Techniques: If standard stealth features aren't enough, contact us at support@browserless.io. We can assist with advanced solutions and specialized infrastructure available on our enterprise plans.

## Next Steps​

Ready to implement stealth routes in your BrowserQL automation? Explore these key areas:

[Solving CAPTCHAsHandle Cloudflare, reCAPTCHA, and other challenges automatically with built-in support.](https://docs.browserless.io/browserql/bot-detection/solving-captchas)
[ProxiesUse residential and external proxies for enhanced anonymity and geographic flexibility.](https://docs.browserless.io/browserql/bot-detection/proxies)
[Bot Detection OverviewLearn about all available bot detection features and strategies in BrowserQL.](https://docs.browserless.io/browserql/bot-detection/overview)

If you need more help or want to discuss your specific use case, don't hesitate to reach out. We're here to help you succeed with even the toughest bot detection challenges.