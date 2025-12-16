# Proxies

Proxies act as intermediaries between your device and the internet, enhancing privacy, security, and geographic flexibility by masking your IP address. This page covers the built-in proxy features in BrowserQL, tips for optimizing bandwidth usage with the reject API, and support for third-party proxies for more advanced configurations.

- Built-in Proxies
- External Proxies

## Built-In Proxies​

BrowserQL supports **residential proxies** to enhance privacy, security, and geographic flexibility in browser automation. These proxies help bypass location-specific restrictions, improve stealth, and avoid IP-based detection mechanisms. With built-in proxying, you can configure:

- Proxy Country: Route requests through a specific country.
- Sticky Proxying: Reuse the same proxy for multiple requests.

### How to Enable Built-In Proxies​

1. Open the Session Settings Panel.
2. Toggle Residential Proxying to On.
3. Configure your settings:

Sticky Proxying: Use the same IP for consecutive requests.
Proxy Country: Select the desired country for proxy routing.

warning

Using a proxy consumes **6 units per MB**.

Watch the video below to learn how to turn on proxy:

Your browser does not support the video tag.

### Programmatic Usage​

You can also enable built-in proxies programmatically by adding proxy parameters directly to your BQL endpoint URL. This is useful when calling BQL from your application code rather than using the IDE.

- Basic Residential Proxy
- Country-Specific Proxy
- Sticky Proxy

```
https://production-sfo.browserless.io/stealth/bql?token=YOUR_API_TOKEN_HERE&proxy=residential
```

```
https://production-sfo.browserless.io/stealth/bql?token=YOUR_API_TOKEN_HERE&proxy=residential&proxyCountry=us
```

```
https://production-sfo.browserless.io/stealth/bql?token=YOUR_API_TOKEN_HERE&proxy=residential&proxyCountry=us&proxySticky=true
```

**Available Parameters:**

- proxy=residential - Enables residential proxy routing
- proxyCountry=us - Routes through a specific country ISO 3166 country codes
- proxyCity=chicago - Routes through a specific city within the selected country
- proxySticky=true - Maintains the same proxy IP across the session when possible

City-Level Proxying

City-level proxying requires a **Scale plan** (500k+ units). Plans under 500k units will receive a `401` error.

To get a list of available cities, use the following endpoints:

- All supported cities: https://production-sfo.browserless.io/proxy/cities?token=YOUR_TOKEN
- Cities for a specific country: https://production-sfo.browserless.io/proxy/cities?country=US&token=YOUR_TOKEN

warning

Using a proxy consumes **6 units per MB**, regardless of whether configured via the IDE or programmatically.

## Optimizing Proxy Usage​

You can optimize your proxy usage by filtering what resources pass through proxies or reject unnecessary requests. This can help reduce bandwidth consumption and improve efficiency when using proxies.

### Filtering specific Requests​

You can define which requests need to be proxied, based on URL pattern, request method and request type. To proxy all requests, simply use `url: "*"` to match everything. To proxy only the document requests, set `type: document` as follows:

```
mutation proxy_filtering{  proxy(server: "http://john:1337@myproxy.com:1234" type: [document, xhr]) {    time  }  goto(url: "https://nordvpn.com/what-is-my-ip/", waitUntil: load) {    status  }}
```

### Using resource rejection​

The reject mutation allows you to block requests based on:

- URL patterns: Use glob-style patterns to match specific domains or paths.
- HTTP methods: Reject specific request methods (e.g., GET, POST).
- Resource types: Filter by resource types, such as images, media, or scripts.
- Operators: Define whether conditions should be combined using "and" (all must match) or "or" (any match).

Bot Detection

While you can reject resources to reduce bandwidth and costs, it could also trigger bot-detection, so use it wisely.

The following example rejects image and media requests, helping save bandwidth:

- Rejecting Images and Media
- Rejecting Media from a Specific Domain

```
mutation RejectImages {  reject(type: [image, media]) {    enabled    time  }  goto(url: "https://cnn.com", waitUntil: firstContentfulPaint) {    status    time  }}
```

To reject media requests originating from the `google.com` domain, use the `and` operator:

```
mutation Reject {  reject(    operator: and    type: image    url: "*google.com*"  ) {    enabled    time  }  goto(url: "https://cnn.com", waitUntil: firstContentfulPaint) {    status    time  }}
```

Behavior

The reject mutation only takes effect during query execution. For instance, scripts that return quickly might still see assets loading in the editor since rejections occur only while mutations are actively running.

## External Proxies​

Alongside the Browserless residential proxy, you can also use an external proxy as well. This is done via the `proxy` mutation, which takes several options with regards to how and when to proxy.

The first requirement is to specify the server's URI to proxy through. This takes the format of `${protocol}://${username}:${password}@${host}:${port}`. For instance, if you have a username of `john` and a password of `1337code` and a URL of `myproxy.com` and a port of `1234`, the server argument would look like: `http://john:1337@myproxy.com:1234`. If you don't have a username or password you can simply omit those fields in the URI. Most proxy servers will also have simple generation widgets that can help build these URI's out for you.

Here's the full snippet in BrowserQL:

```
mutation ExternalProxy {  # Proxy to this server for all requests  proxy(server: "http://john:1337@myproxy.com:1234" url: "*") {    time  }  goto(url: "https://nordvpn.com/what-is-my-ip/", waitUntil: load) {    status  }  waitForTimeout(time: 5000) {    time  }}
```

The second important part of the `proxy` mutation is deciding which requests need to be proxied. BrowserQL supports this by allowing you make patterns of the type of requests you'd like to proxy. You can proxy based upon URL pattern, request methods, and even request types. To proxy *all* requests, simply use `url: "*"` which will match all requests being sent by BrowserQL.

If you want to proxy only the Document requests (typically what most pages are), then you'd set the `type: document` for this. Here's an example of proxying for Document and XHR requests:

```
mutation ProxyDocumentAndXHR {  proxy(server: "http://john:1337@myproxy.com:1234" type: [document, xhr]) {    time  }  goto(url: "https://nordvpn.com/what-is-my-ip/", waitUntil: load) {    status  }  waitForTimeout(time: 5000) {    time  }}
```

Finally, you can mix and match proxies as well with this API. The first proxy that matches the request will be the chosen proxy for that request, so ordering can be important if you want to mix and match proxies for various types of requests.

For instance, you can proxy `document` and `xhr` requests through a residential proxy querying that first, and all other requests through a data-center proxy. Here's how that'd look by specifying the residential proxy *first*, then matching all others via the greedy `url: "*"` pattern:

```
mutation ProxyDocumentAndXHR {  # Proxy document and xhr through residential  residential: proxy(server: "http://john:1337@residential.proxy.com:1234" type: [document, xhr]) {    time  }  # Proxy all else through datacenter  datacenter: proxy(server: "http://john:1337@datacenter.proxy.com:1234" url: "*") {    time  }  goto(url: "https://nordvpn.com/what-is-my-ip/", waitUntil: load) {    status  }  waitForTimeout(time: 5000) {    time  }}
```

## Next Steps​

Ready to take your bot detection bypass to the next level? Explore these key areas:

[Solving CAPTCHAsHandle Cloudflare, reCAPTCHA, and a variety of others automatically with built-in support.](https://docs.browserless.io/browserql/bot-detection/solving-captchas)
[Bot detectionLearn more about our Bot detectiont echniques for BQL](https://docs.browserless.io/browserql/bot-detection/overview)
[Stealthy BQLLearn more about our stealth routes for BQL](https://docs.browserless.io/browserql/bot-detection/stealth)