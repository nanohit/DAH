# Solving CAPTCHAs

CAPTCHAs are a common roadblock in automation. They may appear less when using a [stealth route](https://docs.browserless.io/browserql/bot-detection/stealth) but some sites always enforce them. BrowserQL includes built-in support for CAPTCHA challenges. BQL can detect and interact with CAPTCHAs, even those embedded in iframes or shadow DOMs.

You can use the following mutations:

- Solve
- Solving Image Captcha

## Solve​

DEPRECATION WARNING

The `verify` mutation is deprecated and will be removed in a future version. Please use the `solve` mutation instead.

The [Solve](https://docs.browserless.io/bql-schema/operations/mutations/solve) mutation solves CAPTCHAs on a page. By default, it automatically detects the CAPTCHA type without requiring you to specify it. This auto-detection feature is the preferred approach and simplifies your queries.

info

When solving reCAPTCHAs, it's normal if there isn't a visual confirmation that the CAPTCHA has been solved (i.e., the checkbox may not appear ticked). This is expected behavior. After solving, you should proceed and click on the form's submit button.

```
mutation SolveCaptcha {  goto(url: "https://protected.domain") {    status  }  solve {    found    solved    time  }}
```

### Specifying type​

The `type` argument is optional and can be used to specify which CAPTCHA type to solve. Specifying the type can reduce verification time by a few milliseconds if you're certain which CAPTCHA type is present on the site. We're constantly supporting more CAPTCHAs - you can find the list of supported types in our [browserQL schema](https://docs.browserless.io/bql-schema/types/enums/captcha-types).

```
mutation SolveCaptchaWithType {  goto(url: "https://protected.domain") {    status  }  solve(type: recaptcha) {    found    solved    time  }}
```

### Form Submission After Solving​

After solving a CAPTCHA, you should proceed with form submission by clicking the submit button:

```
mutation SolveAndSubmit {  goto(url: "https://protected.domain") {    status  }  solve {    found    solved    time  }  click(selector: "button[type='submit']") {    time  }}
```

If there isn't a submit button available, you can trigger form submission manually using the `evaluate` mutation:

```
mutation SolveAndTriggerSubmit {  goto(url: "https://protected.domain") {    status  }  solve {    found    solved    time  }  evaluate(content: "window.onSubmit()") {    time  }}
```

Replace `window.onSubmit()` with the appropriate JavaScript function that submits the form on your target website.

## Solving Image Captcha​

The [solveImageCaptcha](https://docs.browserless.io/bql-schema/operations/mutations/solve-image-captcha) mutation is designed for websites that use custom image-based CAPTCHAs where the standard auto-detection (`solve`) doesn't work. Unlike the `solve` mutation which automatically detects and handles common CAPTCHA types like reCAPTCHA or hCaptcha, `solveImageCaptcha` requires you to provide specific CSS selectors for both the captcha image and the input field where the solution should be entered.

This mutation is particularly useful for legacy websites or custom implementations that display a distorted text image and require users to type the characters they see into an input field.

```
mutation SolveImageCaptcha {  goto(url: "https://captcha.com/demos/features/captcha-demo.aspx", waitUntil: networkIdle) {    status  }  solveImageCaptcha(    captchaSelector: "#demoCaptcha_CaptchaImage"    inputSelector: "#captchaCode"    timeout: 30000  ) {    found    solved    time    token  }}
```

### Form submission after solving​

After solving an image captcha, you typically need to submit the form. You can do this by clicking the submit button:

```
mutation SolveImageCaptchaAndSubmit {  goto(url: "https://captcha.com/demos/features/captcha-demo.aspx", waitUntil: networkIdle) {    status  }  solveImageCaptcha(    captchaSelector: "#demoCaptcha_CaptchaImage"    inputSelector: "#captchaCode"  ) {    found    solved    time    token  }  click(selector: "#ValidateCaptchaButton") {    time  }}
```

## Next Steps​

Ready to take your bot detection bypass to the next level? Explore these key areas:

[Bot detectionLearn more about our Bot detection techniques for BQL](https://docs.browserless.io/browserql/bot-detection/overview)
[ProxiesUse residential and external proxies for enhanced anonymity and geographic flexibility.](https://docs.browserless.io/browserql/bot-detection/proxies)
[Stealthy BQLLearn more about our stealth routes for BQL](https://docs.browserless.io/browserql/bot-detection/stealth)