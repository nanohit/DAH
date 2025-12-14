# A guide to use Hybrid with BQL

This guide demonstrates how to use BrowserQL with our Hybrid feature, which allows you to connect Puppeteer or Playwright to an existing BrowserQL session. This is particularly useful when you need to:

- Use BQL-specific features
- Use Puppeteer's or Playwright's rich API alongside BQL
- Monitor browser activity through a LiveURL
- Unblock sites and perform other browser actions by using Puppeteer or Playwright
- Need to provide a LiveURL and listen to when it's being closed.

## LiveURL directly from BQL​

A LiveURL can also be generated directly from BQL, but you won't be able to listen to when it's been closed and then continue using that browser.
The benefit of using a library such as Puppeteer or Playwright in conjunction with BQL is that you'll be able to wait for the end-user to finish using the LiveURL and then continue your automation after that, amongst other workflows.
You can generate a LiveURL from BQL directly and then use the reconnect api as well, however there's a max time to how long the reconnect URL can be alive before it dies off, so using a BQL + LiveURL + Reconnect is best done with a Library such as Puppeteer or Playwright.

## Prerequisites​

Before running this script, make sure you have:

1. Node.js (for JavaScript examples) or Python (for Python examples) installed on your system
2. A browserless API key
3. The required packages, make sure the version is supported by Browserless

- Javascript
- Python

```
# For Playwrightnpm install playwright-core@1.50.1# For Puppeteernpm install puppeteer-core
```

```
pip install playwright requests
```

## Complete Example​

Here's a complete example that shows how to:

1. Initialize a BrowserQL session
2. Connect Puppeteer or Playwright to the session
3. Monitor the session through a LiveURL
4. Perform browser actions
5. Capture screenshots

- Playwright
- Puppeteer
- Python + Playwright

```
// Import required dependenciesimport { chromium } from 'playwright-core';const token = "YOUR_API_TOKEN_HERE";const timeout = 5 * 60 * 1000; // 5 minutes timeoutconst url = 'https://www.example.com';// Configure query parameters for BrowserQLconst queryParams = new URLSearchParams({  token,  timeout,  proxy: "residential", // Use residential proxy for better bot detection bypassing  proxyCountry: "us"   // Set proxy country to US or whichever country the target site is for}).toString();// Define the BQL mutation to initialize the sessionconst query = `  mutation ReconnectToPlaywright($url: String!) {    goto(url: $url, waitUntil: networkIdle) {      status    }    # The mutation below is an example of a bql-specific mutations you could need before connecting to playwright    # solve(type: cloudflare) {    #   found    #   solved    #   time    # }    reconnect(timeout: 30000) {      browserWSEndpoint    }  }`;const variables = { url };// Construct the BrowserQL endpoint URLconst endpoint = `https://production-sfo.browserless.io/chromium/bql?${queryParams}`;// Configure the fetch request optionsconst options = {  method: 'POST',  headers: {    'content-type': 'application/json',  },  body: JSON.stringify({    query,    variables,  }),};// Main execution function(async () => {  try {    console.log(`Initializing BrowserQL session for URL: ${url}`);    // Send the initial BQL query    const response = await fetch(endpoint, options);    if (!response.ok) {      throw new Error(`Failed to initialize session:\n${await response.text()}`);    }    // Extract the WebSocket endpoint for Playwright connection    const { data } = await response.json();    const browserWSEndpoint = data.reconnect.browserWSEndpoint;    const endpointReconnect = `${browserWSEndpoint}?token=${token}`;    console.log(`Session initialized! Connecting Playwright to ${endpointReconnect}`);    // Connect Playwright to the BrowserQL session    const browser = await chromium.connectOverCDP(endpointReconnect);    // Get the existing context and page    const [context] = await browser.contexts();    const page = await context.pages()[0];    // Create a CDP session for advanced browser control    const cdpSession = await context.newCDPSession(page);    // Get the LiveURL for monitoring the session    const { liveURL } = await cdpSession.send('Browserless.liveURL');    console.log('Monitor or interact with your session at:', liveURL); //You can open this in a new tab or place it inside an iFrame    // Example: Perform some browser actions    // await page.click('.some-button');    // await page.type('.some-input', 'Hello World');    /*await page.evaluate(() => {      document.getElementById("myElement")?.remove();    });*/    // Wait for the live session to complete    await new Promise((resolve) => {      cdpSession.on('Browserless.liveComplete', resolve);    });    console.log(`Session completed. URL the session ended on: ${page.url()}`);    // Capture a screenshot of the final state    await page.screenshot({      fullPage: false,      path: 'session-screenshot.png'    });    // Clean up: close the browser connection    await browser.close();    console.log('Browser session closed successfully.');  } catch (error) {    console.error('Session error:', error);  }})();
```

```
// Import required dependenciesimport puppeteer from 'puppeteer-core';const token = "YOUR_API_TOKEN_HERE";const timeout = 5 * 60 * 1000; // 5 minutes timeoutconst url = 'https://www.example.com';// Configure query parameters for BrowserQLconst queryParams = new URLSearchParams({  token,  timeout,  proxy: "residential", // Use residential proxy for better bot detection bypassing  proxyCountry: "us"   // Set proxy country to US or whichever country the target site is for}).toString();// Define the BQL mutation to initialize the sessionconst query = `  mutation ReconnectToPuppeteer($url: String!) {    goto(url: $url, waitUntil: networkIdle) {      status    }    # The mutation below is an example of a bql-specific mutations you could need before connecting to puppeteer    # solve(type: cloudflare) {    #   found    #   solved    #   time    #}    reconnect(timeout: 30000) {      browserWSEndpoint    }  }`;const variables = { url };// Construct the BrowserQL endpoint URLconst endpoint = `https://production-sfo.browserless.io/chromium/bql?${queryParams}`;// Configure the fetch request optionsconst options = {  method: 'POST',  headers: {    'content-type': 'application/json',  },  body: JSON.stringify({    query,    variables,  }),};// Main execution function(async () => {  try {    console.log(`Initializing BrowserQL session for URL: ${url}`);    // Send the initial BQL query    const response = await fetch(endpoint, options);    if (!response.ok) {      throw new Error(`Failed to initialize session:\n${await response.text()}`);    }    // Extract the WebSocket endpoint for Puppeteer connection    const { data } = await response.json();    const browserWSEndpoint = data.reconnect.browserWSEndpoint+`?token=${token}`;    console.log(`Session initialized! Connecting Puppeteer to ${browserWSEndpoint}`);    // Connect Puppeteer to the BrowserQL session    const browser = await puppeteer.connect({      browserWSEndpoint,    });    // Get the existing page    const pages = await browser.pages();    const page = pages.find((p) => p.url().includes(url));    // Create a CDP session for advanced browser control    const cdp = await page.createCDPSession();    // Get the LiveURL for monitoring the session    const { liveURL } = await cdp.send('Browserless.liveURL');    console.log('Monitor or interact with your session at:', liveURL); //You can open this in a new tab or place it inside an iFrame    // Example: Perform some browser actions    // await page.click('.some-button');    // await page.type('.some-input', 'Hello World');    /*await page.evaluate(() => {      document.getElementById("myElement")?.remove();    });*/    // Wait for the live session to complete    await new Promise((resolve) => {      cdp.on('Browserless.liveComplete', resolve);    });    console.log(`Session completed. URL the session ended on: ${page.url()}`);    // Capture a screenshot of the final state    await page.screenshot({      fullPage: false,      path: 'session-screenshot.png'    });    // Clean up: close the browser connection    await browser.close();    console.log('Browser session closed successfully.');  } catch (error) {    console.error('Session error:', error);  }})();
```

```
# Import required dependenciesimport asyncioimport jsonimport requestsfrom playwright.async_api import async_playwrightTOKEN = "YOUR_API_TOKEN_HERE"timeout = 5 * 60 * 1000  # 5 minutes timeouturl = 'https://www.example.com'# Configure query parameters for BrowserQLquery_params = {    'token': TOKEN,    'timeout': timeout,    'proxy': 'residential',  # Use residential proxy for better bot detection bypassing    'proxyCountry': 'us'     # Set proxy country to US or whichever country the target site is for}# Define the BQL mutation to initialize the sessionquery = """  mutation ReconnectToPlaywright($url: String!) {    goto(url: $url, waitUntil: networkIdle) {      status    }    # The mutation below is an example of a bql-specific mutations you could need before connecting to playwright    # solve(type: cloudflare) {    #   found    #   solved    #   time    # }    reconnect(timeout: 30000) {      browserWSEndpoint    }  }"""variables = {'url': url}# Construct the BrowserQL endpoint URLquery_string = '&'.join([f"{key}={value}" for key, value in query_params.items()])endpoint = f"https://production-sfo.browserless.io/chromium/bql?{query_string}"# Configure the fetch request optionspayload = {    'query': query,    'variables': variables}async def main():    try:        print(f"Initializing BrowserQL session for URL: {url}")        # Send the initial BQL query        response = requests.post(            endpoint,            headers={'content-type': 'application/json'},            data=json.dumps(payload)        )        if not response.ok:            raise Exception(f"Failed to initialize session:\n{response.text}")        # Extract the WebSocket endpoint for Playwright connection        data = response.json()['data']        browser_ws_endpoint = data['reconnect']['browserWSEndpoint']        endpoint_reconnect = f"{browser_ws_endpoint}?token={TOKEN}"        print(f"Session initialized! Connecting Playwright to {endpoint_reconnect}")        # Connect Playwright to the BrowserQL session        async with async_playwright() as p:            browser = await p.chromium.connect_over_cdp(endpoint_reconnect)            # Get the existing context and page            contexts = browser.contexts            context = contexts[0]            page = context.pages[0]            # Create a CDP session for advanced browser control            cdp_session = await context.new_cdp_session(page)            # Get the LiveURL for monitoring the session            live_url_response = await cdp_session.send('Browserless.liveURL')            live_url = live_url_response['liveURL']            print(f"Monitor or interact with your session at: {live_url}")            # You can open this in a new tab or place it inside an iFrame            # Example: Perform some browser actions            # await page.click('.some-button')            # await page.fill('.some-input', 'Hello World')            # await page.evaluate("""            #     document.getElementById("myElement")?.remove();            # """)            # Wait for the live session to complete            live_complete = asyncio.Future()            def on_live_complete(event):                if not live_complete.done():                    live_complete.set_result(None)            cdp_session.on('Browserless.liveComplete', on_live_complete)            await live_complete            print(f"Session completed. URL the session ended on: {page.url}")            # Capture a screenshot of the final state            await page.screenshot(                full_page=False,                path='session-screenshot.png'            )            # Clean up: close the browser connection            await browser.close()            print('Browser session closed successfully.')    except Exception as error:        print(f'Session error: {error}')# Run the main functionasyncio.run(main())
```

## Understanding the Code​

### 1. Initial Setup​

- The script requires a browserless API key to work, sign up here
- It configures a 5-minute timeout and sets up residential proxy settings
- The queryParams object contains all necessary parameters for the BrowserQL session

### 2. BQL Query​

- The ReconnectToPlaywright mutation is used to:

Navigate to the specified URL
Wait for network activity to settle
Use BQL-specific features such as solving cloudflare
Get a WebSocket endpoint for Playwright connection

### 3. Library Integration​

- After getting the WebSocket endpoint, Puppeteer or Playwright connects to the BrowserQL session
- The script retrieves the existing browser context and page
- You can further manipulate the website with your chosen library, such as removing unwanted HTML elements before sharing the LiveURL to your end-user.
- A CDP (Chrome DevTools Protocol) session is created for advanced browser control

### 4. Live Monitoring​

- The script obtains a LiveURL through the CDP session
- This URL allows you to monitor and interact with the browser session in real-time
- The session continues until the Browserless.liveComplete event is received

### 5. Cleanup​

- The script captures a screenshot of the final state
- Finally, it properly closes the browser connection

## Best Practices​

1. Error Handling

Always wrap the main execution in a try-catch block
Log errors with meaningful messages
Clean up resources in case of errors
2. Session Management

Set appropriate timeouts for your use case
Use residential proxies when needed
Monitor the LiveURL for debugging
3. Resource Cleanup

Always close browser connections
Save important data (screenshots, logs) before cleanup

## Common Use Cases​

1. Debugging BQL Queries

Use the LiveURL to monitor query execution
Watch network requests and responses
Debug JavaScript errors in real-time
2. Complex Browser Automation

Combine BQL's simplicity and unblocking features with Puppeteer's or Playwright's power
Use CDP for advanced browser control
Capture screenshots and network data
3. Testing and Monitoring

Monitor browser sessions in real-time
Observe the actual flow of an automation
Debug issues with live browser inspection