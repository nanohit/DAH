# Persisting State

The Session API provides explicit programmatic control over browser session lifecycle while enabling BQL (BrowserQL) query execution against persistent sessions. This approach is ideal for advanced automation workflows that require maintaining browser state across multiple script runs, user authentication persistence, and precise session management.

Stealth Sessions Required

BQL functionality is only available for stealth sessions. When creating a session, you must set `stealth: true` to receive the `browserQL` property in the response.

## How Session API with BQL Works​

When you create a stealth session through the Session API, Browserless returns a `browserQL` property containing a fully-qualified URL for running BQL queries against that specific session. This enables you to:

- Maintain browser state including cookies, localStorage, sessionStorage, and navigation state
- Apply session properties like proxy settings, stealth mode, and other configurations to all BQL queries
- Disconnect and reconnect to resume automation from the exact same point
- Manage session lifecycle programmatically with explicit creation and deletion

## Creating a Session with BQL Support​

- JavaScript
- Python
- cURL

```
const sessionConfig = {  ttl: 300000, // 5 minutes  stealth: true, // Required for BQL support  browser: 'chromium',  proxy: {    type: 'residential',    country: 'us',    sticky: true  }};const response = await fetch(  'https://production-sfo.browserless.io/session?token=YOUR_API_TOKEN_HERE',  {    method: 'POST',    headers: { 'Content-Type': 'application/json' },    body: JSON.stringify(sessionConfig),  });if (!response.ok) {  throw new Error(`Failed to create session: ${response.status}`);}const session = await response.json();console.log('Session created:', session.id);console.log('BrowserQL URL:', session.browserQL);console.log('WebSocket URL:', session.connect);console.log('Stop URL:', session.stop);
```

```
import requestssession_config = {    'ttl': 300000,  # 5 minutes    'stealth': True,  # Required for BQL support    'browser': 'chromium',    'proxy': {        'type': 'residential',        'country': 'us',        'sticky': True    }}response = requests.post(    'https://production-sfo.browserless.io/session',    params={'token': 'YOUR_API_TOKEN_HERE'},    json=session_config)response.raise_for_status()session = response.json()print(f'Session created: {session["id"]}')print(f'BrowserQL URL: {session["browserQL"]}')print(f'WebSocket URL: {session["connect"]}')print(f'Stop URL: {session["stop"]}')
```

```
curl -X POST "https://production-sfo.browserless.io/session?token=YOUR_API_TOKEN_HERE" \  -H "Content-Type: application/json" \  -d '{    "ttl": 300000,    "stealth": true,    "browser": "chromium",    "proxy": {      "type": "residential",      "country": "us",      "sticky": true    }  }'
```

### Session Response Schema​

The session creation response includes the following properties:

| Property | Type | Description |
| --- | --- | --- |
| id | string | Unique session identifier |
| connect | string | WebSocket URL for CDP-based libraries (Puppeteer, Playwright) |
| browserQL | string | Fully-qualified URL for running BQL queries (stealth sessions only) |
| stop | string | URL for session termination via DELETE request |
| ttl | number | Session time-to-live in milliseconds |

## Running BQL Queries Against Sessions​

Once you have a session with BQL support, use the `browserQL` URL to execute GraphQL mutations. All session properties (proxy settings, stealth mode, etc.) automatically apply to BQL queries.

- JavaScript
- Python

```
// Using the browserQL URL from session creationconst browserQLURL = session.browserQL;const firstQuery = `  mutation FirstQuery {    goto(url: "https://example.com", waitUntil: networkIdle) {      status    }    title {      title    }    evaluate(content: "localStorage.setItem('testData', 'persistent-value')") {      value    }  }`;const firstResponse = await fetch(browserQLURL, {  method: 'POST',  headers: { 'Content-Type': 'application/json' },  body: JSON.stringify({ query: firstQuery })});const firstResult = await firstResponse.json();console.log('First query result:', firstResult.data);
```

```
# Using the browserQL URL from session creationbrowserql_url = session['browserQL']first_query = """mutation FirstQuery {  goto(url: "https://example.com", waitUntil: networkIdle) {    status  }  title {    title  }  evaluate(content: "localStorage.setItem('testData', 'persistent-value')") {    value  }}"""first_response = requests.post(    browserql_url,    json={'query': first_query})first_result = first_response.json()print('First query result:', first_result['data'])
```

## Session State Persistence and Reconnection​

One of the key benefits of Session API with BQL is the ability to disconnect and reconnect while maintaining all browser state. This includes localStorage, cookies, navigation state, and any other browser data.

- JavaScript
- Python

```
// Complete example showing session creation, usage, and reconnectionconst sessionResponse = await fetch('https://production-sfo.browserless.io/session?token=YOUR_API_TOKEN_HERE', {  method: 'POST',  headers: {     'Content-Type': 'application/json'  },  body: JSON.stringify({    ttl: 300000, // 5 minutes    stealth: true,    browser: 'chromium'  })});const session = await sessionResponse.json();console.log('Session created');console.log('Session ID:', session.id);console.log('BrowserQL URL:', session.browserQL);// Wait for session to be readyconsole.log('Waiting for session to be ready...');await new Promise(resolve => setTimeout(resolve, 2000));console.log('Setting localStorage...');const firstQuery = `  mutation FirstQuery {    goto(url: "https://example.com", waitUntil: networkIdle) {      status    }    title {      title    }    evaluate(content: "localStorage.setItem('testData', 'persistent-value'); return localStorage.getItem('testData');") {      value    }  }`;console.log('Making first BrowserQL query...');const firstResponse = await fetch(session.browserQL, {  method: 'POST',  headers: {     'Content-Type': 'application/json'  },  body: JSON.stringify({ query: firstQuery })});const firstResult = await firstResponse.json();console.log('First query result:', firstResult.data);// Wait before next queryawait new Promise(resolve => setTimeout(resolve, 2000));// Check if localStorage persistsconsole.log('Checking if localStorage persists...');const checkQuery = `  mutation CheckQuery {    goto(url: "https://example.com", waitUntil: networkIdle) {      status    }    evaluate(content: "localStorage.getItem('testData') || 'no-data-found'") {      value    }    url {      url    }    title {      title    }  }`;console.log('Making check BrowserQL query...');const checkResponse = await fetch(session.browserQL, {  method: 'POST',  headers: {     'Content-Type': 'application/json'  },  body: JSON.stringify({ query: checkQuery })});const checkResult = await checkResponse.json();console.log('Check Query Result:');console.log('Raw response:', JSON.stringify(checkResult, null, 2));console.log('localStorage value:', checkResult.data?.evaluate?.value);console.log('Current URL:', checkResult.data?.url?.url);console.log('Page title:', checkResult.data?.title?.title);console.log('Cleaning up...');await new Promise(resolve => setTimeout(resolve, 1000));const deleteResponse = await fetch(session.stop, {   method: 'DELETE'});if (deleteResponse.ok) {  const deleteResult = await deleteResponse.json();  console.log('Session deleted successfully:', deleteResult.message);} else {  console.log('Session deletion failed:', deleteResponse.status);}const checkValue = checkResult.data?.evaluate?.value;console.log('Final localStorage check:', checkValue);
```

```
import requestsimport time# Create sessionsession_response = requests.post(    'https://production-sfo.browserless.io/session',    params={'token': 'YOUR_API_TOKEN_HERE'},    json={        'ttl': 300000,  # 5 minutes        'stealth': True,        'browser': 'chromium'    })session = session_response.json()print('Session created')print(f'Session ID: {session["id"]}')print(f'BrowserQL URL: {session["browserQL"]}')# Wait for session to be readyprint('Waiting for session to be ready...')time.sleep(2)print('Setting localStorage...')first_query = """mutation FirstQuery {  goto(url: "https://example.com", waitUntil: networkIdle) {    status  }  title {    title  }  evaluate(content: "localStorage.setItem('testData', 'persistent-value'); return localStorage.getItem('testData');") {    value  }}"""print('Making first BrowserQL query...')first_response = requests.post(    session['browserQL'],    json={'query': first_query})first_result = first_response.json()print('First query result:', first_result['data'])# Wait before next querytime.sleep(2)# Check if localStorage persistsprint('Checking if localStorage persists...')check_query = """mutation CheckQuery {  goto(url: "https://example.com", waitUntil: networkIdle) {    status  }  evaluate(content: "localStorage.getItem('testData') || 'no-data-found'") {    value  }  url {    url  }  title {    title  }}"""print('Making check BrowserQL query...')check_response = requests.post(    session['browserQL'],    json={'query': check_query})check_result = check_response.json()print('Check Query Result:')print('Raw response:', check_result)print(f'localStorage value: {check_result["data"]["evaluate"]["value"]}')print(f'Current URL: {check_result["data"]["url"]["url"]}')print(f'Page title: {check_result["data"]["title"]["title"]}')print('Cleaning up...')time.sleep(1)delete_response = requests.delete(session['stop'])if delete_response.ok:    delete_result = delete_response.json()    print(f'Session deleted successfully: {delete_result["message"]}')else:    print(f'Session deletion failed: {delete_response.status_code}')check_value = check_result['data']['evaluate']['value']print(f'Final localStorage check: {check_value}')
```

## Session Configuration Options​

All session configuration options apply to both WebSocket connections and BQL queries:

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| ttl | number | 300000 | Time-to-live in milliseconds (max varies by plan) |
| stealth | boolean | false | Required for BQL support - enables stealth mode |
| headless | boolean | true | Run browser in headless mode |
| browser | string | 'chromium' | Browser type ('chromium' or 'chrome') |
| blockAds | boolean | false | Enable ad-blocking |
| args | string[] | [] | Additional Chrome launch arguments |
| proxy | object | null | Proxy configuration (applies to all BQL queries) |

### Proxy Configuration​

When proxy settings are configured for a session, they automatically apply to all BQL queries executed against that session:

```
const sessionWithProxy = {  ttl: 300000,  stealth: true,  proxy: {    type: 'residential',    country: 'us',    state: 'california',    city: 'san-francisco',    sticky: true  }};// All BQL queries will use the configured proxy settings
```

## Session Management​

### Checking Session Status​

You can verify session status by making a simple BQL query:

```
const statusQuery = `  mutation CheckStatus {    url {      url    }  }`;const response = await fetch(session.browserQL, {  method: 'POST',  headers: { 'Content-Type': 'application/json' },  body: JSON.stringify({ query: statusQuery })});if (response.ok) {  console.log('Session is active');} else {  console.log('Session may have expired');}
```

### Terminating Sessions​

Sessions automatically expire after their TTL, but you can manually terminate them:

```
// Using the stop URL from session creationconst stopResponse = await fetch(session.stop, {  method: 'DELETE'});if (stopResponse.ok) {  console.log('Session terminated successfully');}
```

## Comparison with BQL Reconnect​

The Session API approach differs from the standard BQL `reconnect` mutation:

| Feature | Session API + BQL | BQL Reconnect |
| --- | --- | --- |
| Session Creation | Explicit via REST API | Implicit with first query |
| Lifecycle Control | Programmatic start/stop | Timeout-based only |
| State Management | Persistent across disconnections | Requires active connection |
| Proxy Configuration | Set once, applies to all queries | Per-query configuration |
| Stealth Requirement | Required for BQL support | Available for all BQL queries |

## Best Practices​

1. Always use stealth mode when you need BQL functionality
2. Set appropriate TTL based on your workflow duration
3. Handle session expiration gracefully in your applications
4. Reuse sessions for multiple related operations to maintain state
5. Configure proxy settings at session creation for consistent behavior
6. Monitor session status before executing long-running operations

## Next Steps​

- Reconnecting to Browserless - Learn about standard BQL reconnection patterns
- Puppeteer & Playwright Integration - Mix BQL with Puppeteer and Playwright workflows
- BQL Language Basics - Master BQL query syntax and mutations