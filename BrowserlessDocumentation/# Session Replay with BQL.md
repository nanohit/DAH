# Session Replay with BQL

The **Session Replay** feature in BrowserQL allows you to record browser sessions and later replay them for debugging and analysis. When using BQL, session recording is controlled through connection parameters and provides seamless integration with GraphQL mutations.

This feature is particularly useful for:

- Debugging complex BQL automation workflows
- Creating visual documentation of GraphQL-based browser automation
- Troubleshooting BQL mutations with recorded evidence

## Prerequisites​

Before using Session Replay with BQL, make sure you have:

1. A Browserless account with Session Replay access
2. A browserless API key
3. Access to the BQL endpoint
4. Understanding of GraphQL mutation syntax

## Recording a Session with BQL​

### Connection String Configuration​

To enable session recording with BQL, add the `replay=true` parameter to your connection string:

```
wss://production-sfo.browserless.io?token=YOUR_API_TOKEN_HERE&replay=true
```

### Basic Recording Example​

- CURL
- JavaScript
- Python

```
curl --request POST \  --url 'https://production-sfo.browserless.io/chrome/bql?token=YOUR_API_TOKEN_HERE&replay=true' \                                     --header 'Content-Type: application/json' \  --data '{"query":"mutation replay {\n  goto(url: \"https://www.browserless.io\") {\n  \ttime\n  }\n  click(selector:\"a\"){\n    time\n  }\n  waitForTimeout(time:2000){\n    time\n  }\n}","variables":{},"operationName":"replay"}'
```

```
import fetch from 'node-fetch';const API_KEY = "YOUR_API_TOKEN_HERE";const BQL_ENDPOINT = `https://production-sfo.browserless.io/chromium/bql?replay=true&token=${API_KEY}`;const recordingQuery = `mutation replay {  goto(url: "https://www.browserless.io") {    time  }   click(selector:"a"){    time  }  waitForTimeout(time:2000){    time  }}`;const recordSession = async () => {  const response = await fetch(BQL_ENDPOINT, {    method: 'POST',    headers: {      'Content-Type': 'application/json'    },    body: JSON.stringify({ query: recordingQuery,"operationName":"replay" })  });  const result = await response.json();  console.log('Recording Result:', JSON.stringify(result, null, 2));    // Session recording automatically stops when the BQL query completes  console.log('Session recorded successfully');};recordSession().catch(console.error);
```

```
import requestsimport jsonAPI_KEY = "YOUR_API_TOKEN_HERE"BQL_ENDPOINT = f"https://production-sfo.browserless.io/chromium/bql?replay=true&token={API_KEY}"recording_query = """mutation RecordSession {  goto(url: "https://www.example.com") {    status    time  }    click(selector: "button.example") {    time    x    y  }    type(selector: "input[name='search']", text: "browserless") {    time  }    waitForSelector(selector: ".search-results") {    time  }}"""def record_session():    response = requests.post(        BQL_ENDPOINT,        headers={            'Content-Type': 'application/json'        },        json={'query': recording_query}    )        result = response.json()    print('Recording Result:', json.dumps(result, indent=2))        # Session recording automatically stops when the BQL query completes    print('Session recorded successfully')if __name__ == "__main__":    record_session()
```