# Scraping Structured Data

Many pages have structure to them where one can infer a data hierarchy. This can simple things like a list of products, their prices, and even reviews. In such cases where you run into these hierarchies we heavily recommend using the `mapSelector` query to "map" over this data and return a well structured response.

This query allows you to functionally "map" over repetitive, hierarchical data in the page and extract data. This query is very powerful in that you can get *any* kind of data out of the page, including data in attributes, textual data, or even further nested data.

Let's take a look at the Hacker News as an example. This site has posts that are easily retrieved by mapping over the `submission` class on the page. In BrowserQL, this would look like this:

```
mutation MapHN {  goto(url: "https://news.ycombinator.com/", waitUntil: domContentLoaded) {    status  }  posts: mapSelector(selector: ".post") {    itemId: id  }}
```

Here, we're using the `post` class as a way to target each post on the page, and then we ask for the "id" attribute of the post. We also are using aliases to further give semantic meaning to these actions as well so it's clear what we're getting in response. When ran this will return a data structure like so:

```
{  "data": {    "goto": {      "status": 200    },    "posts": [      {        "itemId": "43128253"      },      {        "itemId": "43130732"      },    ...}
```

Taking this a step further, we can now map over each *post* and get more details like author, rank, and even comment count. Since these each have their own repetitive structure within the page, we can nest a second `mapSelector` call and get that nested data:

```
mutation MapHN {  goto(url: "https://news.ycombinator.com", waitUntil: networkIdle) {    status  }  # Iterate over each submission  posts: mapSelector(selector: ".submission") {    itemId: id    # Get the ranking of the submission    rank: mapSelector(selector: ".rank", wait: true) {      rank: innerText    }    # Get the link of the submission    link: mapSelector(selector: ".titleline > a", wait: true) {      # You can query for arbitrary tags attributes as well by using the "attribute" mechanism.      link: attribute(name: "href") {        value      }    }  }}
```

When using a nested `mapSelector` this will keep hierarchy intact. This means that each "rank" and "link" in the data will be the items that are nested in each submission.

Finally, since mapping is a functional programming concept, this means that all responses returned are iterable, meaning an array of items even if it is just a single item. In this case, rank and links are a single item in an array.

## Next Steps​

Ready to explore more advanced BrowserQL features? Check out these related topics:

[Multi-line JavaScript EvaluationLearn how to execute complex JavaScript code in the browser environment using the evaluate mutation.](https://docs.browserless.io/browserql/advanced-config/multi-line-javascript)
[Parsing LibrariesIntegrate BrowserQL with popular parsing libraries like Beautiful Soup, Scrapy, and Cheerio.](https://docs.browserless.io/browserql/advanced-config/parsing-libraries)