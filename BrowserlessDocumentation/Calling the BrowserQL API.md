# Calling the BrowserQL API

BrowserQL allows you to design queries in the **IDE** and then export them as ready-to-use API calls in multiple programming languages.
This makes it easy to test your logic in the IDE and then integrate it directly into your applications.

Recommended Endpoint

For production use with bot detection bypass, use the **/stealth/bql** route instead of the standard `/bql` route. The stealth routes provide advanced anti-detection capabilities for better success rates with protected sites. [Explore more stealth routes](https://docs.browserless.io/browserql/bot-detection/stealth).

### Exporting Your Query​

Once your query is working in the IDE, follow these steps to ensure reliable results outside of the BQL IDE:

1. Click Export as Code.
2. Select your preferred language.
3. Copy the generated snippet, which includes the endpoint, token, headers, and payload.
4. For bot detection bypass: Replace /chromium/bql or /chrome/bql with /stealth/bql in the endpoint URL.

### Example BQL Query​

The following query navigates to [Hacker News](https://news.ycombinator.com/), clicks the **Jobs** tab, and extracts the HTML of the page:

```
mutation ExtractJobsHTML {  goto(url: "https://news.ycombinator.com", waitUntil: firstMeaningfulPaint) {    status  }  click(selector: "span.pagetop > a[href='jobs']") {    x    y  }  html {    html  }}
```

### Exported Query as API Call​

Here’s what the exported query looks like in different languages:

- JavaScript
- Python
- Java

```
const url = "https://production-sfo.browserless.io/stealth/bql?token=YOUR_API_TOKEN_HERE";  const options = {    method: "POST",    headers: {      'Content-Type': 'application/json'    },    body: '{"query":"mutation ExtractJobsHTML {\\\\n  goto(url: \\\\"https://news.ycombinator.com\\\\", waitUntil: firstMeaningfulPaint) { status }\\\\n  click(selector: \\\\"span.pagetop > a[href=\\'jobs\\']\\\\") { x y }\\\\n  html { html }\\\\n}","variables":null,"operationName":"ExtractJobsHTML"}'  };  try {    const response = await fetch(url, options);    const data = await response.json();    console.log(data);  } catch (error) {    console.error(error);  }
```

```
import http.clientimport jsonquery = """mutation ExtractJobsHTML {  goto(url: "https://news.ycombinator.com", waitUntil: firstMeaningfulPaint) {    status  }  click(selector: "span.pagetop > a[href='jobs']") {    x    y  }  html {    html  }}"""conn = http.client.HTTPSConnection("production-sfo.browserless.io")  payload = json.dumps({"query": query})headers = {"Content-Type": "application/json"}  conn.request("POST", "/stealth/bql?token=YOUR_API_TOKEN_HERE", payload, headers)  res = conn.getresponse()  data = res.read()  print(data.decode("utf-8"))
```

```
HttpResponse<String> response = Unirest.post("https://production-sfo.browserless.io/stealth/bql?token=YOUR_API_TOKEN_HERE")    .header("Content-Type", "application/json")    .body("{\\"query\\":\\"mutation ExtractJobsHTML {\\\\n  goto(url: \\\\\\"https://news.ycombinator.com\\\\\\", waitUntil: firstMeaningfulPaint) { status }\\\\n  click(selector: \\\\\\"span.pagetop > a[href='jobs']\\\\\\") { x y }\\\\n  html { html }\\\\n}\\",\\"variables\\":null,\\"operationName\\":\\"ExtractJobsHTML\\"}")    .asString();  System.out.println(response.getBody());
```

### Parsing the API Response​

After calling the API, the response contains raw HTML.
You can parse it using libraries like:

- JavaScript
- Python
- Java

```
const { JSDOM } = require("jsdom");  async function ExtractJobsHTML() {    const url = "https://production-sfo.browserless.io/stealth/bql?token=YOUR_API_TOKEN_HERE";    const options = {      method: "POST",      headers: {        'Content-Type': 'application/json'      },      body: '{"query":"mutation ExtractJobsHTML {\\\\n  goto(url: \\\\"https://news.ycombinator.com\\\\", waitUntil: firstMeaningfulPaint) { status }\\\\n  click(selector: \\\\"span.pagetop > a[href=\\'jobs\\']\\\\") { x y }\\\\n  html { html }\\\\n}","variables":null,"operationName":"ExtractJobsHTML"}'    };    try {      const response = await fetch(url, options);      const json = await response.json();      const html = json.data.html.html;      const dom = new JSDOM(html);      const rows = dom.window.document.querySelectorAll("tr.athing");      const results = [...rows].map((row) => {        const anchor = row.querySelector("a");        return anchor ? { title: anchor.textContent.trim(), link: anchor.href } : null;      }).filter(Boolean);      console.log(results);    } catch (error) {      console.error(error);    }  }  ExtractJobsHTML();
```

```
import http.clientfrom bs4 import BeautifulSoupimport jsonquery = """mutation ExtractJobsHTML {  goto(url: "https://news.ycombinator.com", waitUntil: firstMeaningfulPaint) {    status  }  click(selector: "span.pagetop > a[href='jobs']") {    x    y  }  html {    html  }}"""conn = http.client.HTTPSConnection("production-sfo.browserless.io")  payload = json.dumps({"query": query})headers = {"Content-Type": "application/json"}  conn.request("POST", "/stealth/bql?token=YOUR_API_TOKEN_HERE", payload, headers)  res = conn.getresponse()  response = res.read()  response_json = json.loads(response.decode("utf-8"))  html = response_json["data"]["html"]["html"]  soup = BeautifulSoup(html, "html.parser")  results = [      {"title": a.text.strip(), "link": a["href"]}      for a in soup.select("tr.athing a")  ]  print(results)
```

```
import com.mashape.unirest.http.HttpResponse;  import com.mashape.unirest.http.Unirest;  import org.jsoup.Jsoup;  import org.jsoup.nodes.Document;  import org.jsoup.nodes.Element;  import org.jsoup.select.Elements;  import com.google.gson.JsonObject;  import com.google.gson.JsonParser;  public class ExtractJobsHTML {      public static void main(String[] args) throws Exception {          HttpResponse<String> response = Unirest.post("https://production-sfo.browserless.io/stealth/bql?token=YOUR_API_TOKEN_HERE")              .header("Content-Type", "application/json")              .body("{\\"query\\":\\"mutation ExtractJobsHTML {\\\\n  goto(url: \\\\\\"https://news.ycombinator.com\\\\\\", waitUntil: firstMeaningfulPaint) { status }\\\\n  click(selector: \\\\\\"span.pagetop > a[href='jobs']\\\\\\") { x y }\\\\n  html { html }\\\\n}\\",\\"variables\\":null,\\"operationName\\":\\"ExtractJobsHTML\\"}")              .asString();          JsonObject jsonResponse = JsonParser.parseString(response.getBody()).getAsJsonObject();          String html = jsonResponse.getAsJsonObject("data").getAsJsonObject("html").get("html").getAsString();          Document doc = Jsoup.parse(html);          Elements jobs = doc.select("tr.athing a");          for (Element job : jobs) {            System.out.println("Title: " + job.text());            System.out.println("Link: " + job.attr("href"));        }    }}
```

## Troubleshooting: Different Results Between IDE and API Calls​

If your API calls return different data, miss elements, or behave differently than the IDE, it is very important to use the Export as Code feature. It automatically includes all exact settings from your IDE session, ensuring identical behavior between testing and production.

## Next Steps​

Explore these key features to enhance your browser automation:

[Session ManagementConnect your BQL sessions to puppeteer or playwright.](https://docs.browserless.io/browserql/session-management/reconnect-to-browserless)
[Writing Your First QueryStart creating BrowserQL automation scripts with step-by-step guidance](https://docs.browserless.io/browserql/writing-bql/language-basics)
[Bot DetectionMaster advanced techniques to bypass anti-bot measures and access protected sites](https://docs.browserless.io/browserql/bot-detection/overview)