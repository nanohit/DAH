# Waiting for Things

BrowserQL offers 5 different ways to wait for preconditions to be met on the page before returning the response. These built-in waiters make your automations more reliable by responding to real page conditions, avoiding the fragility of fixed delays.

- waitForNavigation
- waitForRequest
- waitForResponse
- waitForSelector
- waitForTimeout

BQL Schemas

For more details on BQL mutations, refer to the [BrowserQL Schema](https://docs.browserless.io/bql-schema/schema) reference pages.

## waitForNavigation​

Waits for a navigation event to fire, useful for clicking an element and waiting for a page load.

The object can have any of these values:

- timeout: Float, optional — The maximum amount of time, in milliseconds, to wait for the page to load, overriding any defaults. Default timeout is 30 seconds, or 30000.
- waitUntil: WaitUntilGoto enum, optional — When to consider the page fully-loaded and proceed with further execution

```
mutation waitingForNavigation {  goto(url: "https://example.com/") {    status  }  waitForNavigation(waitUntil: load) {    status  }}
```

## waitForRequest​

Waits for the browser to make a particular request.

The object can have any of these values:

- method: Method, optional — The method of the request to wait for.
- timeout: Float, optional — How long to wait for the request to be made before timing out, overriding any defaults. Default timeout is 30 seconds, or 30000.
- url: String, optional — The pattern of the request URL to wait for, using glob-style pattern-matching.

```
mutation waitingForARequest {  goto(url: "https://example.com/") {    status  }  waitForRequest(method: GET) {    time  }}
```

## waitForResponse​

Waits for a particular network response to be made back to the browser.

The object can have any of these values:

- statuses: [int] list, optional — The HTTP Response code(s) of the URL to wait for. Can be a single HTTP code or a list of desired codes.
- url: String, optional — The pattern of the response URL to wait for, using glob-style pattern-matching.

```
mutation waitingForAResponse {  goto(url: "https://example.com/") {    status  }  waitForResponse(codes: [200]) {    time  }}
```

## waitForSelector​

Wait for a selector to appear in page. If at the moment of calling the method the selector already exists, the method will return immediately. If the selector doesn't appear after the timeout milliseconds of waiting, the function will throw.

The object can have any of these values:

- selector: String, required — A valid CSS selector.
- timeout: Number, optional — Maximum number of milliseconds to wait for the selector before failing.
- visible: Boolean, optional — Wait for the selected element to be present in DOM and to be visible, i.e. to not have display: none or visibility: hidden CSS properties.

```
mutation waitingForASelector {  goto(url: "https://example.com/") {    status  }  waitForSelector(selector: "h1" timeout: 5000) {    selector  }}
```

## waitForTimeout​

If all else doesn't work, you can always wait for a predefined number of milliseconds.

The object needs the following value:

- time: Float, required - The amount of time to wait for, in milliseconds.

```
mutation waitingForAHardcodedTimeout {  goto(url: "https://example.com/") {    status  }  waitForTimeout(time: 1000) {    time  }}
```

## Next Steps​

Master the art of waiting in BrowserQL? Explore these advanced topics to build more reliable automations:

[Using ExportsSave and use dynamic data in later actions for better flexibility and reuse](https://docs.browserless.io/browserql/writing-bql/exporting-variables)
[Exporting ScriptsExport your waiting-enabled BQL queries to integrate with your development workflow](https://docs.browserless.io/browserql/using-the-ide/using-api-calls)
[Advanced ConfigurationsExplore advanced BrowserQL features and configurations for complex automation scenarios](https://docs.browserless.io/browserql/advanced-config/scraping-structured-data)