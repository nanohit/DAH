# Language Basics

Learning a new language can be intimidating, but mastering BQL doesn't have to be difficult. This guide provides a straightforward overview of how to write BQL with clear examples.

## GraphQL Basics for BQL​

BrowserQL uses **GraphQL** as its query language. If you're new to GraphQL, here are the key concepts you need to know:

### Mutations vs Queries​

- Mutations: Actions that change state (like navigating, clicking, typing). In BQL, everything is a mutation because all actions happen inside the browser.
- Queries: Read-only operations (not used in BQL since browser automation requires actions).

### Basic GraphQL Syntax​

Every Graphql script follows this pattern:

```
mutation ScriptName {  actionName(arguments) {    responseFields  }}
```

### Key GraphQL Concepts in BQL​

- Arguments: Parameters you pass to actions (like url: "https://example.com")
- Response Fields: Data you want back (like status, time, text)
- Aliases: Custom names for actions (like firstClick: click(...))

Refer to the following resources for a deeper understanding of GraphQL:

- Official GraphQL Documentation
- GraphQL Query Language Guide
- GraphQL Best Practices

## Understanding BQL Structure​

A BQL script consists of a **mutation** that contains one or more **fields**:

```
mutation ScriptName {  field1(arguments) { responses }  field2(arguments) { responses }}
```

Each field represents a browser action. Let's break down what makes up a field:

### Anatomy of a Mutation Field​

Each field has three components:

1. Field Name: The action to perform (e.g., goto, click, type)
2. Arguments: Parameters that configure the action (e.g., url, selector, text)
3. Response Fields: The data you want returned (e.g., status, time, text)

**Example:**

```
mutation ExampleName {  fieldName(argument: "value") {    responseField  }}
```

Complete Reference

Find all available mutations, arguments, and responses in the [BQL API Reference](https://docs.browserless.io/bql-schema/operations/mutations/back) or the [Built-in Documentation](https://docs.browserless.io/browserql/using-the-ide/ide-features#built-in-documentation) in the IDE.

### Combining Multiple Actions​

BQL's power comes from chaining multiple actions in a single mutation. With core fields like [goto](https://docs.browserless.io/bql-schema/operations/mutations/goto), [text](https://docs.browserless.io/bql-schema/operations/mutations/text), [click](https://docs.browserless.io/bql-schema/operations/mutations/click), [type](https://docs.browserless.io/bql-schema/operations/mutations/type), and [solve](https://docs.browserless.io/bql-schema/operations/mutations/solve), you can build complex automations concisely.

### Using Aliases​

When using the same mutation field multiple times in a query, you must provide **aliases** to distinguish them. GraphQL requires unique field names within the same mutation:

```
mutation LoginForm {  goto(url: "https://example.com/login") {    status  }    click(selector: "#email-field") {    x    y  }    click(selector: "#password-field") {  # ❌ Error: Duplicate field name    x    y  }}
```

The above **mutation will fail** because both `click` operations have the same field name.

**Solution:** Use aliases to make each field unique. Aliases also let you customize how results appear in your JSON response:

```
mutation LoginForm {  goto(url: "https://example.com/login") {    status  }    clickEmail: click(selector: "#email-field") {    x    y  }    clickPassword: click(selector: "#password-field") {    x    y  }    typeEmail: type(    selector: "#email-field"    text: "user@example.com"  ) {    time  }    typePassword: type(    selector: "#password-field"    text: "securepassword"  ) {    time  }    submitLogin: click(selector: "#login-button") {    x    y  }}
```

#### JSON Response with Aliases​

The aliases become the keys in your JSON response, making the data structure clear and meaningful:

```
{  "data": {    "goto": {      "status": 200    },    "clickEmail": {      "x": 150,      "y": 200    },    "clickPassword": {      "x": 150,      "y": 250    },    "typeEmail": {      "time": 245    },    "typePassword": {      "time": 189    },    "submitLogin": {      "x": 200,      "y": 350    }  }}
```

Pro Tip

**Avoid reserved words**: Don't use GraphQL keywords as aliases

## Common BQL Patterns​

Now that you understand the fundamentals, let's explore common patterns for building automation scripts.

### Extracting Data​

Use `text` or `html` mutations to extract information from pages:

- Extract Text
- Extract HTML

```
mutation GetProductInfo {  goto(url: "https://example.com/product") {    status  }  productName: text(selector: "span#productTitle") {    text  }}
```

**Returns:**

```
{  "productName": {    "text": "Coffee and Espresso Maker"  }}
```

tip

Omit the `selector` to retrieve the entire page's text content.

```
mutation GetPageHTML {  goto(url: "https://example.com") {    status  }  pageContent: html(selector: "div.content") {    html  }}
```

**Returns:**

```
{  "pageContent": {    "html": "<h1>Example Domain</h1><p>This domain is for use in illustrative examples...</p>"  }}
```

tip

Omit the `selector` to retrieve the entire page's HTML.

### Interacting with Pages​

BrowserQL automatically waits for elements to be present, visible, and scrolls them into view. Use `click` and `type` mutations to interact with page elements.

#### Clicking Elements​

```
mutation ClickExample {  goto(url: "https://example.com/login") {    status  }  loginButton: click(    selector: "button#login"    visible: true  ) {    x    y  }}
```

**Setting Timeouts:** By default, BQL waits up to 30 seconds for elements. Override with the `timeout` argument (in milliseconds):

```
click(  selector: "button#login"  timeout: 10000  // Wait max 10 seconds) {  x  y}
```

#### Typing Text​

BQL types with human-like randomized delays between keystrokes for natural input patterns.

```
mutation TypeExample {  goto(url: "https://google.com") {    status  }  searchInput: type(    selector: "form textarea"    text: "BrowserQL automation"  ) {    time  }}
```

**Custom Typing Delays:** Control the keystroke delay range with the `delay` argument `[min, max]` in milliseconds:

```
type(  selector: "input#email"  text: "user@example.com"  delay: [50, 150]  // Random delay between 50-150ms per keystroke) {  time}
```

### Solving CAPTCHAs​

DEPRECATION WARNING

The `verify` mutation is deprecated and will be removed in a future version. Please use the `solve` mutation instead.

The [solve](https://docs.browserless.io/bql-schema/operations/mutations/solve) mutation automatically handles CAPTCHAs, even when hidden in iframes or shadow DOMs:

```
mutation BypassCaptcha {  goto(url: "https://example.com/login") {    status  }  solveCaptcha: solve(type: cloudflare) {    found    solved    time  }}
```

### Hybrid Mode: Connecting Puppeteer/Playwright​

Generate a WebSocket endpoint to connect external libraries like Puppeteer or Playwright to your BQL session:

```
mutation HybridSession {  goto(url: "https://example.com") {    status  }  reconnect(timeout: 30000) {    browserWSEndpoint  }}
```

Use the returned `browserWSEndpoint` to connect your library and continue automation. [Learn more about hybrid mode](https://docs.browserless.io/browserql/hybrid-bql).

## Next Steps​

BrowserQL simplifies web automation with intuitive commands and a structure that's easy to learn. Explore these key areas to build more sophisticated automations:

[Conditional LogicLearn how to create "do A or do B" workflows that adapt to different page conditions](https://docs.browserless.io/browserql/writing-bql/conditional-logic)
[Waiting for ThingsMaster the art of waiting for elements, navigation events, and network responses](https://docs.browserless.io/browserql/writing-bql/waiting-for-things)
[Exporting ScriptsConvert your BQL queries to code in multiple programming languages for integration](https://docs.browserless.io/browserql/using-the-ide/using-api-calls)