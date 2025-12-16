# Injecting Cookies

Cookie management is essential for maintaining session state, authentication, and personalized user experiences during browser automation. BrowserQL provides powerful cookie injection and extraction capabilities through the `cookies` mutation, allowing you to set cookies before navigation and retrieve them after page interactions.

## Cookie Operations​

The `cookies` mutation in BrowserQL serves dual purposes:

- Setting cookies: Pass an array of CookieInput objects to inject cookies into the browser
- Getting cookies: Call without parameters to retrieve all cookies from the current page

### Cookie Input Structure​

When setting cookies, use the `CookieInput` type with the following properties:

- name (required): Cookie name
- value (required): Cookie value
- domain: Cookie domain (e.g., "example.com")
- path: Cookie path (defaults to "/")
- secure: Boolean indicating if cookie requires HTTPS
- httpOnly: Boolean for HTTP-only cookies
- sameSite: Cookie SameSite policy (Strict, Lax, or None)
- expires: Expiration timestamp (session cookie if not set)
- url: Request URI to associate with the cookie

### Cookie Response​

The mutation returns a `CookieResponse` containing:

- cookies: Array of StandardCookie objects with name, value, domain, path, and security properties
- time: Execution time in milliseconds

## Complete Cookie Management Example​

Here's a comprehensive example demonstrating cookie injection and extraction using the test site setcookie.net:

- BrowserQL
- JavaScript
- Python

```
mutation cookies {  setCookies: cookies(cookies: [    {      name: "test_cookie"      value: "123456"      domain: "setcookie.net"      path: "/"      secure: true    }  ]) {    cookies {      name      value    }  }  waitForTimeout(time: 3000) {    time  }  goto(url: "https://setcookie.net/", waitUntil: networkIdle) {    status  }  getCookies: cookies {    cookies {      name      value      domain      path      secure    }  }}
```

```
import fetch from 'node-fetch';const API_KEY = "YOUR_API_TOKEN_HERE";const BQL_ENDPOINT = `https://production-sfo.browserless.io/chromium/bql?token=${API_KEY}`;const cookieQuery = `mutation cookies {  setCookies: cookies(cookies: [    {      name: "test_cookie"      value: "123456"      domain: "setcookie.net"      path: "/"      secure: true    }  ]) {    cookies {      name      value    }  }  waitForTimeout(time: 3000) {    time  }  goto(url: "https://setcookie.net/", waitUntil: networkIdle) {    status  }  getCookies: cookies {    cookies {      name      value      domain      path      secure    }  }}`;async function manageCookies() {  const response = await fetch(BQL_ENDPOINT, {    method: 'POST',    headers: {      'Content-Type': 'application/json'    },    body: JSON.stringify({ query: cookieQuery })  });  const result = await response.json();  console.log('Cookie Management Result:', JSON.stringify(result, null, 2));    // Access the set cookies  console.log('Set Cookies:', result.data.setCookies.cookies);    // Access the retrieved cookies  console.log('Retrieved Cookies:', result.data.getCookies.cookies);}manageCookies().catch(console.error);
```

```
import requestsimport jsonAPI_KEY = "YOUR_API_TOKEN_HERE"BQL_ENDPOINT = f"https://production-sfo.browserless.io/chromium/bql?token={API_KEY}"cookie_query = """mutation cookies {  setCookies: cookies(cookies: [    {      name: "test_cookie"      value: "123456"      domain: "setcookie.net"      path: "/"      secure: true    }  ]) {    cookies {      name      value    }  }  waitForTimeout(time: 3000) {    time  }  goto(url: "https://setcookie.net/", waitUntil: networkIdle) {    status  }  getCookies: cookies {    cookies {      name      value      domain      path      secure    }  }}"""def manage_cookies():    response = requests.post(        BQL_ENDPOINT,        headers={            'Content-Type': 'application/json'        },        json={'query': cookie_query}    )        result = response.json()    print('Cookie Management Result:', json.dumps(result, indent=2))        # Access the set cookies    print('Set Cookies:', result['data']['setCookies']['cookies'])        # Access the retrieved cookies      print('Retrieved Cookies:', result['data']['getCookies']['cookies'])if __name__ == "__main__":    manage_cookies()
```

## Common Use Cases​

### Authentication Cookies​

Set authentication cookies before navigating to protected pages:

```
mutation setAuthCookie {  cookies(cookies: [    {      name: "session_token"      value: "abc123xyz789"      domain: "example.com"      path: "/"      secure: true      httpOnly: true    }  ]) {    cookies {      name      value    }  }  goto(url: "https://example.com/dashboard") {    status  }}
```

HttpOnly Cookie Limitations

HttpOnly cookies are protected by the browser and cannot be accessed or modified via client-side JavaScript or automation frameworks like BrowserQL, Puppeteer, or Playwright. This security design prevents cross-site scripting (XSS) attacks from stealing authentication tokens. If your workflow requires persisting HttpOnly cookies for authentication across sessions, you should use our [persisting sessions](https://docs.browserless.io/baas/session-management/persisting-state) feature, which maintains all browser state including HttpOnly cookies between reconnections.

### Preference Cookies​

Inject user preference cookies to customize page behavior:

```
mutation setPreferences {  cookies(cookies: [    {      name: "theme"      value: "dark"      domain: "example.com"    },    {      name: "language"      value: "en-US"      domain: "example.com"    }  ]) {    cookies {      name      value    }  }}
```

### Cookie Extraction for Analysis​

Retrieve cookies after user interactions to analyze session data:

```
mutation extractCookies {  goto(url: "https://example.com/login") {    status  }  typeUsername: type(selector: "#username", text: "user@example.com") {    time  }  typePassword: type(selector: "#password", text: "password123") {    time  }  click(selector: "#login-button") {    time  }  waitForSelector(selector: ".dashboard") {    time  }  cookies {    cookies {      name      value      domain      expires      secure      httpOnly    }  }}
```

Cookie management in BrowserQL provides the foundation for sophisticated session handling, enabling seamless automation of authenticated workflows and personalized user experiences.