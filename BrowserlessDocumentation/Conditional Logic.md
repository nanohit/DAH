# Conditional Logic

One of BrowserQL's most powerful features is its ability to create dynamic, condition-based workflows using `if` and `ifnot` mutations. This allows you to build smart automation that adapts to different scenarios, handles errors gracefully, and creates branching logic based on page conditions.

Conditional logic in BrowserQL allows you to:

- Handle different page states (loaded vs. error)
- Respond to varying content (elements present vs. absent)
- Create fallback behaviors (try method A, fallback to method B)
- Build adaptive scraping (different selectors for different page layouts)

## Basic Conditional Structure​

The basic pattern for conditional logic in BrowserQL uses two key mutations:

- if: Executes nested mutations when a condition is true
- ifnot: Executes nested mutations when a condition is false

```
mutation ConditionalExample {  goto(url: "https://example.com") {    status  }    if(condition) {    // Do A - when condition is true  }    ifnot(condition) {    // Do B - when condition is false  }}
```

### Response Code Conditions​

One of the most common scenarios is handling different HTTP response codes.

- Basic Response Handling
- Multiple Response Codes

```
mutation ResponseHandling {  goto(url: "https://protected-site.com") {    status  }    # If we get a 403 Forbidden - handle bot detection  if(response: {codes: 403}) {    solve(type: cloudflare) {      solved    }        # Try navigation again after verification    goto(url: "https://protected-site.com") {      status    }  }    # If we get a successful response - proceed normally  ifnot(response: {codes: 403}) {    title {      title    }        text(selector: "h1") {      text    }  }}
```

```
mutation MultipleResponseHandling {  goto(url: "https://example.com") {    status  }    # Handle client errors (4xx)  ifError4xx:if(response: {codes: [400, 401, 403, 404]}) {    screenshot {      base64    }        text(selector: "body") {      text    }  }    # Handle server errors (5xx)  ifError5xx:if(response: {codes: [500, 502, 503]}) {    waitForTimeout(time: 5000) {      time    }        # Retry the request    goto(url: "https://example.com") {      status    }  }    # Handle successful responses (2xx)  ifnot(response: {codes: [400, 401, 403, 404, 500, 502, 503]}) {    html(selector: "main") {      html    }  }}
```

### Element Presence Conditions​

Check if elements exist on the page and create different workflows accordingly.

- Cookie Banner Handling
- Different Login Forms

```
mutation CookieBannerHandling {  goto(url: "https://example.com") {    status  }    # If cookie banner exists - accept cookies  if(selector: "#cookie-banner, .cookie-consent, [data-testid='cookie-banner']") {    click(selector: "#cookie-banner .accept, .cookie-consent .accept") {      x      y    }        waitForTimeout(time: 1000) {      time    }  }    # Whether banner existed or not, continue with main content  text(selector: "h1") {    text  }    html(selector: ".main-content") {    html  }}
```

```
mutation AdaptiveLogin {  goto(url: "https://app.example.com/login") {    status  }    # Check for email/password form  if(selector: "input[type='email'], input[name='email']") {    typeEmail:type(selector: "input[type='email'], input[name='email']", text: "user@example.com") {      selector    }        typePassword: type(selector: "input[type='password']", text: "password123") {      selector    }        click(selector: "button[type='submit'], .login-btn") {      x      y    }  }    # Check for username/password form (different structure)  ifnot(selector: "input[type='email'], input[name='email']") {    typeUsername: type(selector: "input[name='username'], #username", text: "myusername") {      selector    }        typePassword: type(selector: "input[type='password']", text: "password123") {      selector    }        click(selector: "button[type='submit'], .submit-btn") {      x      y    }  }}
```

### Content-Based Conditions​

Make decisions based on the actual content of the page.

- Search Results Handling
- Content Variations

```
mutation SearchResultsHandling {  goto(url: "https://example-store.com") {    status  }    # Perform search  type(selector: ".search-input", text: "wireless headphones") {    selector  }    click(selector: ".search-button") {    x    y  }    # Wait for results to load  waitForTimeout(time: 2000) {    time  }    # If results found - extract product data  if(selector: ".product-item, .search-result-item") {    mapSelector(selector: ".product-item") {      name: text(selector: ".product-name")      price: text(selector: ".product-price")       rating: text(selector: ".product-rating")      imageUrl: attribute(selector: ".product-image img", name: "src")    }  }    # If no results found - try alternative search  ifnot(selector: ".product-item, .search-result-item") {    # Clear search and try broader term    clickClear: click(selector: ".search-clear, .clear-button") {      x      y    }        type(selector: ".search-input", text: "headphones") {      selector    }        clickSearch: click(selector: ".search-button") {      x      y    }        waitForTimeout(time: 2000) {      time    }        # Extract whatever results we get    mapSelector(selector: ".product-item, .item") {      name: text(selector: ".product-name, .item-title")      price: text(selector: ".product-price, .price")    }  }}
```

```
mutation ContentVariations {  goto(url: "https://news-site.com") {    status  }    # Check for paywall  if(selector: ".paywall, .subscription-required, [data-paywall]") {    # Try to find free preview content    text(selector: ".article-preview, .free-content") {      text    }        # Look for alternative free articles    mapSelector(selector: ".free-article") {      title: text(selector: ".article-title")      excerpt: text(selector: ".article-excerpt")      link: attribute(selector: "a", name: "href")    }  }    # If no paywall - get full article content  ifnot(selector: ".paywall, .subscription-required, [data-paywall]") {    titleText: text(selector: "h1, .article-title") {      text    }        content: html(selector: ".article-content, .post-content") {      html    }        authorText: text(selector: ".author, .byline") {      text    }        publishDateText: text(selector: ".publish-date, .date") {      text    }  }}
```

## Sequential Conditional Logic​

You can create complex decision trees using sequential conditional logic. Note that `if` and `ifnot` mutations cannot be nested within each other, but you can achieve the same logical outcomes using sequential conditionals with compound selectors:

```
mutation SequentialConditions {  goto(url: "https://e-commerce-site.com/product/123") {    status  }    # Check for product with discount (exists, in stock, on sale)  ifStockDiscounted: if(selector: ".product-details .in-stock .discount, .product-details .available .sale-price") {    mapSelector(selector: ".product-details") {      name: text(selector: ".product-name")      originalPrice: text(selector: ".original-price")       salePrice: text(selector: ".sale-price")      discount: text(selector: ".discount-percent")    }  }    # Check for product in stock without discount  ifStock: if(selector: ".product-details .in-stock:not(.discount), .product-details .available:not(.sale-price)") {    mapSelector(selector: ".product-details") {      name: text(selector: ".product-name")      price: text(selector: ".price")      availability: text(selector: ".stock-status")    }  }    # Check for product out of stock  ifOutOfStock: if(selector: ".product-details:not(:has(.in-stock)):not(:has(.available))") {    mapSelector(selector: ".product-details") {      name: text(selector: ".product-name")      status: text(selector: ".out-of-stock, .unavailable")      restockDate: text(selector: ".restock-date")    }  }    # Product doesn't exist - capture error info  ifnot(selector: ".product-details") {    text(selector: ".error-message, .not-found") {      text    }  }}
```

### Fallback Strategies​

Create robust automation with multiple fallback options using sequential conditionals:

```
mutation FallbackStrategies {  goto(url: "https://dynamic-site.com") {    status  }    # Try primary selector  if(selector: ".primary-selector") {    text(selector: ".primary-selector") {      text    }  }    # Try secondary selector (only if primary doesn't exist)  ifnot1: ifnot(selector: ".primary-selector") {    text(selector: ".secondary-selector") {      text    }  }    # Try tertiary selector (only if primary and secondary don't exist)  ifnot2: ifnot(selector: ".primary-selector, .secondary-selector") {    text(selector: ".tertiary-selector") {      text    }  }    # Last resort fallback (if none of the above exist)  ifnot3: ifnot(selector: ".primary-selector, .secondary-selector, .tertiary-selector") {    text(selector: "body") {      text    }  }}
```

## Next Steps​

Now that you understand conditional logic, explore these related topics to build even more sophisticated automations:

[Waiting for ThingsCombine conditional logic with precise waiting strategies for robust automation](https://docs.browserless.io/browserql/writing-bql/waiting-for-things)
[Exporting ScriptsConvert your conditional BQL queries to code for integration into your applications](https://docs.browserless.io/browserql/using-the-ide/using-api-calls)
[Bot DetectionUse conditional logic to handle complex detection scenarios and CAPTCHA challenges](https://docs.browserless.io/browserql/bot-detection/overview)