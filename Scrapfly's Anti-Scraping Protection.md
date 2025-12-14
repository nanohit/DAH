Scrapfly's Anti-Scraping Protection is designed to unblock protected websites that are inaccessible to bots. We accomplish this by incorporating various concepts that help maintain a coherent fingerprint, making it as close to that of a real user as possible when scraping a website.

To use ASP just enable asp parameter in your API call.

Scrapfly is capable of identifying and resolving obstacles posed by commonly used anti-scraping measures. Our platform also provides support for custom anti-scraping measures implemented by popular websites. Scrapfly ASP bypass does not require any extra input from you, and you will receive successful responses automatically.

If you are interested in understanding the technical aspects of how we achieve this undetectability, we have published a series of articles on the subject available in the learning resources section below.

Usage and Abuse Limitation
Usage

When ASP is enabled, anti-bot solution vendor are automatically detected and everything is managed to bypass it.

Curl
HTTP
Try
curl -G \
--request "GET" \
--url "https://api.scrapfly.io/scrape" \
--data-urlencode "asp=true" \
--data-urlencode "key=scp-live-2c3a4b7f0499465bba348f99022fbacb" \
--data-urlencode "url=https://httpbin.dev/anything"
ASP will fine-tune some parameters regardless of user configuration. Some examples are listed below:

These adjustments can increase the request credit price and for that check the pricing section for more details.

Proxy Pool: ASP can access exclusive private proxy pools specific to scraped targets or upgrade to a better general proxy pool.
Browser Usage: ASP might enable it to bypass pages that require javascript.
Headers: Some browser headers set by you might be ignored or modified. Headers based on resource type (image, file, html etc) and referer can be fine-tuned as well. We can also add custom headers if the target require or challenge method require them.
referer is auto generated if not present, you can pass none as header value to no pass any referer header to the target website
cookie ASP auto handle session usage and reuse challenge cookies for faster result
accept can be changed regarding the type of resources (images, script, json, xhr, etc)
content-type based on request body and website target format
user-agent: Make sure to set a custom user-agent only when required by the target website, as the user agent is already managed by ASP for optimal bypass.
Chrome based user agent are ignored and will be replaced by the one provided for the fingerprint
Non-Chrome user agent are left untouched
Country: Base on target website location and usual traffic, ASP might fine-tune the proxy country. If you set country explicitly the ASP will respect this.
OS: To align fingerprint for optimal bypass we may change the OS and related headers based on the exit proxy hardware.
Body: JSON are re-encoded to produce the same serialized output as a real web browser.
ASP Limitations

While popular anti-bot vendors can be bypassed without any additional effort, there are still some areas that require manual configuration of calls.

For best results, it's important to understand how the target websites work and replicate their behavior in scraping calls. ASP bypass handles bot detection, and it's up to the user to configure last mile settings to avoid identification through use patterns.

How to avoid anti bot detection on POST request

Avoiding anti-bot detection on a POST request can be tricky, but there are some key areas to focus on:

Mimic a real user's behavior: Anti-bot systems often check for unusual behavior that may indicate a bot, such as a high number of requests from the same IP address or at the same time. You can mimic a real user's behavior by visiting some pages to retrieve navigation cookies/referers urls.

Handling CSRF: Cross-Site Request Forgery (CSRF) is a common anti-bot measure used by websites.

For more, see these tutorials and resources:

CSRF header tutorial on Scrapfly's Scrapeground.
introduction to headers in scraper blocking blog post.
Use realistic headers: Anti-bot systems can detect bots by looking at the headers of the requests. You should try to replicate the headers of a real user's request as closely as possible. This includes the Accept, Content-Type, Referer and Origin headers. Make sure to configure correctly the value of Accept and Content-Type regarding the content you expect (json, html).

For more, see these tutorials and resources:

Referer header tutorial on Scrapfly's Scrapeground.
introduction to headers in scraper blocking blog post.
Authentication: If the website requires authentication, make sure you include the correct credentials in your request. This might involve logging in to the website first, then including the session cookie or token in your POST request. If the API/Website requires it, ASP is not able to manage this, you must handle it on your side.

For more, see these tutorials and resources:

Cookies authentication tutorial on Scrapfly's Scrapeground.
Overall, the key to bypassing anti-bot measures on a POST request is to replicate the headers, cookies, and authentication of a regular browser request as closely as possible. This requires careful inspection of the website's code and network traffic to identify the required elements.

Website with Private/Hidden API

Scraping a private API can be a bit more challenging than scraping public APIs. Here are some recommendations to follow:

Make sure you have permission: Before scraping any private API, make sure you have the necessary permission from the website owner or API provider. Scraping a private API without permission can result in legal consequences.
Mimic a real user: When scraping a private API, it's important to mimic a real user as closely as possible. This means sending the same headers and parameters that a real user would send when accessing the API.
Use authentication: Most private APIs require some form of authentication, such as a token or API key. Make sure you obtain the necessary credentials and use them in your requests.
Monitor for changes: Private APIs can change over time, so it's important to monitor for any changes in the API's structure or authentication requirements. If you notice any changes, update your scraping code accordingly.
Overall, scraping private APIs requires more attention to detail and careful configuration of requests. Following these recommendations can help ensure a successful and ethical scraping process.

Maximize Your Success Rate

Network Quality

In many cases, datacenter IPs are sufficient. However, anti-bot vendors may check the origin of the IP when protecting websites, to determine if the traffic comes from a datacenter or a regular connection. In such cases, residential networks can provide a better IP reputation, as they are registered under a regular ASN that helps control the origin of the IP.

Introduction To Proxies in Web Scraping
How to Avoid Web Scraping Blocking: IP Address Guide
Learn how to change the network type
 API Usage: proxy_pool=public_residential_pool, checkout the related documentation
Use a Browser

Most anti bots check the browser fingerprint and javascript engine to generate detection metrics.

 API Usage: render_js=true, checkout the related documentation
Verify Cookies and Headers

Observe headers/cookies of regular calls that are successful; you can figure out if you need to add extra headers or retrieve specific cookies to authenticate. You can use the dev tool and inspect the network activity.

What are Chrome Devtools?
How to Avoid Web Scraping Blocking: Headers Guide
 API Usage: headers[referer]=https%3A%2F%2Fweb-scraping.dev (value is url encoded), checkout the related documentation
Navigation Coherence

To ensure navigation coherence when scraping unofficial APIs, you may need to obtain cookies from your navigation. One way to do this is by enabling session and rendering JavaScript during the initial scraping to retrieve cookies. Once the cookies are stored in your session, you can continue scraping without rendering JavaScript while still applying the previously obtained cookies for consistency. The following Scrapfly features you must take a look to achieve that:

Using Session (sticky proxy - keep same ip, Cookies memory)
Javascript Rendering - Headless browser
 API Usage: session=my-unique-session-name, checkout the related documentation
 API Usage: render_js=true, checkout the related documentation
Geo Blocking

When browsing certain websites, users may encounter blocks based on their IP location. Scrapfly can bypass this issue by default, as it selects a random country from its pool. However, specifying the country based on the location of the website can be a helpful way to avoid geo-blocking.

 API Usage: country=us, checkout the related documentation