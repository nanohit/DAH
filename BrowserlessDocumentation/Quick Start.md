# Quick Start

Get started with BrowserQL in minutes by following these steps:

1. Sign UpSign up for a Browserless account (free plan available).
2. Get API KeyGet your API Key from the account dashboard.
3. Access IDEAccess the BQL web editor. Learn more about using the IDE.
4. Run Your First QueryCopy and paste this example query into the IDE to scrape the first headline from Hacker News, and click play:mutation ScrapeHN {  goto(url: "https://news.ycombinator.com", waitUntil: firstMeaningfulPaint) {    status    time  }  firstHeadline: text(selector: ".titleline") {    text  }}Click Run in the IDE to execute this query.Breaking this down, we're:

Defining we want to run a mutation and naming our script as ScrapeHN

Instructing a browser to goto the Hacker News site, and wait for the firstMeaningfulPaint event to fire

Asking to return both the time it took and the HTTP-code's status once the waitUntil has fired

Giving our action an alias, in this case firstHeadline

Extracting the text of a specified selector
5. Check OutputThe result will be a JSON response:{"data": {"viewport": {  "width": 1366,  "height": 768,  "time": 2},"goto": {  "status": 200,  "time": 1467},"firstHeadline": {  "text": "Rust cross-platform GPUI components (github.com/longbridge)"}}}

tip

Don't worry if you're new to GraphQL! BQL's syntax is intuitive, and you can learn as you go. Check out the [Language Basics](https://docs.browserless.io/browserql/writing-bql/language-basics) section to understand GraphQL concepts in BQL.

## Exporting Your QueryвЂ‹

You can export your BrowserQL queries and run them programmatically in your application. [Learn how to export and use queries in your code](https://docs.browserless.io/browserql/using-the-ide/using-api-calls).

## Next StepsвЂ‹

Ready to start building with BrowserQL? Explore these key areas to maximize your browser automation capabilities:

[Writing BrowserQLMaster GraphQL mutations, aliases, and BQL syntax to create powerful browser automation scripts](https://docs.browserless.io/browserql/writing-bql/language-basics)
[Using the IDEExplore built-in documentation, query history, code export, and keyboard shortcuts in the BQL Editor](https://docs.browserless.io/browserql/using-the-ide/ide-features)
[Launch ParametersConfigure browser launch options and settings to customize your automation environment](https://docs.browserless.io/browserql/launch-parameters)