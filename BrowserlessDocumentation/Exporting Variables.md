# Exporting Variables

Many queries in BrowserQL produce data that you might want to reuse in subsequent queries or export for use outside of BrowserQL. BrowserQL provides an `@export` feature, called a "directive", that allows you to save query results into variables for later use.

This is especially useful for capturing dynamic data from web pages, such as tokens, IDs, or any other information that needs to be referenced in later steps of your automation. Using this feature can help streamline your workflows and make your automations more efficient without having to run several queries to capture and reuse data.

BQL Schemas

For more details on BQL mutations, refer to the [BrowserQL Schema](https://docs.browserless.io/bql-schema/schema) reference pages.

## Export Directive​

Using the directive is straightforward. You simply append `@export(as: "name")` to the field you want to export. The required `as` argument specifies the name of the variable that will hold the exported value, which you can use in subsequent actions.

Once a variable is exported, you'll need to reference it somewhere where you want to use it. You can do this by using the `${variableName}` syntax in the parameters of other actions. This tells BrowserQL to substitute the value of the exported variable at that point in the query.

Let's use Hacker News as an example. Suppose you want to export the title of the top story on Hacker News and use it in a later action. Your query would look like this:

```
mutation NavigateToTopPost {  # First navigate to HN  goto(url: "https://news.ycombinator.com/") {    status  }  # Next, run some JavaScript on the page to find the first submission link  evaluate(content: "document.querySelector('.athing.submission .title a').href") {    # This is where we both define what value we want to export and give it a name    value @export(as: "topStoryLink")  }  # In order to use this reference you'll need to use a "${variableName}" syntax  # where you want to use the variable, here we use it in the goto action's url param  gotoTopLink: goto(url:"${topStoryLink}") {    status  }  # Finally, let's grab the title of the page!  title {    title  }}
```

For now exports support only scalar values like strings and numbers. Complex objects or arrays cannot be exported directly but may be supported in the future.

If you attempt to use an export that hasn't been defined yet, BrowserQL will treat it as a regular string and simply pass through the raw text itself unaltered.

## Next Steps​

Master the art of waiting in BrowserQL? Explore these advanced topics to build more reliable automations:

[Waiting For ThingsCombine waiting strategies with conditional logic to handle different page states dynamically](https://docs.browserless.io/browserql/writing-bql/waiting-for-things)
[Exporting ScriptsExport your waiting-enabled BQL queries to integrate with your development workflow](https://docs.browserless.io/browserql/using-the-ide/using-api-calls)
[Advanced ConfigurationsExplore advanced BrowserQL features and configurations for complex automation scenarios](https://docs.browserless.io/browserql/advanced-config/scraping-structured-data)