# Multi-line JavaScript Evaluation

The `evaluate` mutation allows you to execute JavaScript in the browser's page environment. For multi-line scripts, you must wrap your code in an IIFE (Immediately Invoked Function Expression) using triple quotes:

```
mutation MultiLineEvaluate {  goto(url: "https://example.com") {    status  }    evaluate(content: """  (() => {    try {      const title = document.title;      const url = window.location.href;      return JSON.stringify({ title, url, error: null });    } catch (e) {      return JSON.stringify({ title: null, url: null, error: (e?.message ?? String(e)) });    }  })()  """) {    value  }}
```

**Key requirements:**

- Use triple quotes (""") for multi-line code
- Wrap your code in an IIFE: (()=>{ ... })()
- Return values from your code execution

**Example use cases:**

- Extract complex data from the DOM
- Manipulate page elements dynamically, such as deleting or adding elements to the HTML
- Perform calculations or transformations

## Advanced Examples​

### Extracting Complex Data​

```
mutation ExtractComplexData {  goto(url: "https://example.com") {    status  }    evaluate(content: """  (() => {    try {      // Extract all links with their text and href      const links = Array.from(document.querySelectorAll('a')).map(link => ({        text: link.textContent.trim(),        href: link.href,        isExternal: !link.href.includes(window.location.hostname)      }));            // Get page metadata      const meta = {        title: document.title,        description: document.querySelector('meta[name="description"]')?.content || '',        keywords: document.querySelector('meta[name="keywords"]')?.content || '',        viewport: document.querySelector('meta[name="viewport"]')?.content || ''      };            return JSON.stringify({ links, meta, error: null });    } catch (e) {      return JSON.stringify({ links: null, meta: null, error: (e?.message ?? String(e)) });    }  })()  """) {    value  }}
```

### Dynamic Element Manipulation​

```
mutation ManipulateElements {  goto(url: "https://example.com") {    status  }    evaluate(content: """  (() => {    try {      // Remove all ads      const ads = document.querySelectorAll('[class*="ad"], [id*="ad"], [class*="banner"]');      ads.forEach(ad => ad.remove());            // Add a custom element      const customDiv = document.createElement('div');      customDiv.innerHTML = '<h2>Custom Content Added by BrowserQL</h2>';      customDiv.style.cssText = 'background: #f0f0f0; padding: 20px; margin: 20px 0; border-radius: 5px;';      document.body.insertBefore(customDiv, document.body.firstChild);            return JSON.stringify({        removedAds: ads.length,        addedElement: 'Custom div added to page',        error: null      });    } catch (e) {      return JSON.stringify({ removedAds: null, addedElement: null, error: (e?.message ?? String(e)) });    }  })()  """) {    value  }}
```

### Data Transformation and Calculations​

```
mutation DataTransformation {  goto(url: "https://example.com") {    status  }    evaluate(content: """  (() => {    try {      // Extract and transform price data      const priceElements = document.querySelectorAll('[class*="price"], [class*="cost"]');      const prices = Array.from(priceElements).map(el => {        const text = el.textContent;        const price = parseFloat(text.replace(/[^0-9.]/g, ''));        return {          originalText: text,          numericValue: price,          currency: text.match(/[$€£¥]/)?.[0] || 'unknown'        };      }).filter(p => !isNaN(p.numericValue));            // Calculate statistics      const total = prices.reduce((sum, p) => sum + p.numericValue, 0);      const average = prices.length > 0 ? total / prices.length : 0;      const min = Math.min(...prices.map(p => p.numericValue));      const max = Math.max(...prices.map(p => p.numericValue));            return JSON.stringify({        prices,        statistics: { total, average, min, max, count: prices.length },        error: null      });    } catch (e) {      return JSON.stringify({ prices: null, statistics: null, error: (e?.message ?? String(e)) });    }  })()  """) {    value  }}
```

### Handling Links That Open in New Tabs​

When automating interactions with links that have `target="_blank"`, you can modify them to open in the same browser session. This simplifies your script by avoiding the need to switch tabs or manage multiple page contexts.

```
mutation avoidNewTab {  goto(url: "https://www.example.com", waitUntil: networkIdle) {    status  }  evaluate(content: """  (() => {    const link = document.querySelector('a');    if (link && link.target === '_blank') {      link.target = '_self';    }  })()  """) {    time  }  click(selector: "a") {    time  }}
```

This approach modifies links from opening in new tabs to opening in the same session, keeping your automation workflow simple and avoiding complex tab management.

## Best Practices​

1. Always use IIFE: Wrap your code in (()=>{ ... })() to avoid variable conflicts
2. Return meaningful data: Make sure your function returns the data you need
3. Handle errors gracefully: Use try-catch blocks for robust error handling
4. Keep it focused: Write focused, single-purpose scripts for better maintainability

## Next Steps​

Ready to explore more advanced BrowserQL features? Check out these related topics:

[Scraping Structured DataLearn how to use mapSelector to extract hierarchical data from web pages.](https://docs.browserless.io/browserql/advanced-config/scraping-structured-data)
[Parsing LibrariesIntegrate BrowserQL with popular parsing libraries like Beautiful Soup, Scrapy, and Cheerio.](https://docs.browserless.io/browserql/advanced-config/parsing-libraries)