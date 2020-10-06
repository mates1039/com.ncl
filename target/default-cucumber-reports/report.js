$(document).ready(function() {var formatter = new CucumberHTML.DOMFormatter($('.cucumber-report'));formatter.uri("file:src/test/resources/features/NCLFiltering.feature");
formatter.feature({
  "name": "NCL navigate page",
  "description": "",
  "keyword": "Feature",
  "tags": [
    {
      "name": "@ncl"
    }
  ]
});
formatter.background({
  "name": "User navigates to ncl.com",
  "description": "",
  "keyword": "Background"
});
formatter.before({
  "status": "passed"
});
formatter.step({
  "name": "User navigates to ncl.com",
  "keyword": "Given "
});
formatter.match({
  "location": "stepdefinitions.NCLHomePageStepdefinition.user_navigates_to_ncl_com()"
});
formatter.result({
  "status": "passed"
});
formatter.scenario({
  "name": "User filters cruises by destination and price",
  "description": "",
  "keyword": "Scenario",
  "tags": [
    {
      "name": "@ncl"
    }
  ]
});
formatter.step({
  "name": "User searches for \"Hawaii Cruises\"",
  "keyword": "Given "
});
formatter.match({
  "location": "stepdefinitions.NCLHomePageStepdefinition.user_searches_for(java.lang.String)"
});
formatter.result({
  "status": "passed"
});
formatter.step({
  "name": "User filters result by price range from $0 to $1500",
  "keyword": "And "
});
formatter.match({
  "location": "stepdefinitions.NCLFilterStepdefinition.user_filters_result_by_price_range_from_$0_to_$1500()"
});
formatter.result({
  "error_message": "org.openqa.selenium.ElementClickInterceptedException: element click intercepted: Element \u003cspan class\u003d\"e52_text\"\u003e...\u003c/span\u003e is not clickable at point (1307, 279). Other element would receive the click: \u003csection id\u003d\"bootstrap_modal\" class\u003d\"modal fade modal-leads show\" tabindex\u003d\"-1\" role\u003d\"dialog\" aria-labelledby\u003d\"modal\" style\u003d\"display: block;\"\u003e...\u003c/section\u003e\n  (Session info: chrome\u003d85.0.4183.121)\nBuild info: version: \u00273.141.59\u0027, revision: \u0027e82be7d358\u0027, time: \u00272018-11-14T08:17:03\u0027\nSystem info: host: \u0027apples-MacBook-Air.local\u0027, ip: \u0027fe80:0:0:0:3:ea66:f9e0:e927%en0\u0027, os.name: \u0027Mac OS X\u0027, os.arch: \u0027x86_64\u0027, os.version: \u002710.15.5\u0027, java.version: \u00271.8.0_251\u0027\nDriver info: org.openqa.selenium.chrome.ChromeDriver\nCapabilities {acceptInsecureCerts: false, browserName: chrome, browserVersion: 85.0.4183.121, chrome: {chromedriverVersion: 85.0.4183.87 (cd6713ebf92fa..., userDataDir: /var/folders/k8/hg4cbk3x6dl...}, goog:chromeOptions: {debuggerAddress: localhost:49794}, javascriptEnabled: true, networkConnectionEnabled: false, pageLoadStrategy: normal, platform: MAC, platformName: MAC, proxy: Proxy(), setWindowRect: true, strictFileInteractability: false, timeouts: {implicit: 0, pageLoad: 300000, script: 30000}, unhandledPromptBehavior: dismiss and notify, webauthn:virtualAuthenticators: true}\nSession ID: 13917c66042f1d8bd1840ea7a4e01ed2\n\tat sun.reflect.NativeConstructorAccessorImpl.newInstance0(Native Method)\n\tat sun.reflect.NativeConstructorAccessorImpl.newInstance(NativeConstructorAccessorImpl.java:62)\n\tat sun.reflect.DelegatingConstructorAccessorImpl.newInstance(DelegatingConstructorAccessorImpl.java:45)\n\tat java.lang.reflect.Constructor.newInstance(Constructor.java:423)\n\tat org.openqa.selenium.remote.http.W3CHttpResponseCodec.createException(W3CHttpResponseCodec.java:187)\n\tat org.openqa.selenium.remote.http.W3CHttpResponseCodec.decode(W3CHttpResponseCodec.java:122)\n\tat org.openqa.selenium.remote.http.W3CHttpResponseCodec.decode(W3CHttpResponseCodec.java:49)\n\tat org.openqa.selenium.remote.HttpCommandExecutor.execute(HttpCommandExecutor.java:158)\n\tat org.openqa.selenium.remote.service.DriverCommandExecutor.execute(DriverCommandExecutor.java:83)\n\tat org.openqa.selenium.remote.RemoteWebDriver.execute(RemoteWebDriver.java:552)\n\tat org.openqa.selenium.remote.RemoteWebElement.execute(RemoteWebElement.java:285)\n\tat org.openqa.selenium.remote.RemoteWebElement.click(RemoteWebElement.java:84)\n\tat sun.reflect.NativeMethodAccessorImpl.invoke0(Native Method)\n\tat sun.reflect.NativeMethodAccessorImpl.invoke(NativeMethodAccessorImpl.java:62)\n\tat sun.reflect.DelegatingMethodAccessorImpl.invoke(DelegatingMethodAccessorImpl.java:43)\n\tat java.lang.reflect.Method.invoke(Method.java:498)\n\tat org.openqa.selenium.support.pagefactory.internal.LocatingElementHandler.invoke(LocatingElementHandler.java:51)\n\tat com.sun.proxy.$Proxy17.click(Unknown Source)\n\tat stepdefinitions.NCLFilterStepdefinition.user_filters_result_by_price_range_from_$0_to_$1500(NCLFilterStepdefinition.java:15)\n\tat ✽.User filters result by price range from $0 to $1500(file:///Users/apple/IdeaProjects/com.ncl/src/test/resources/features/NCLFiltering.feature:9)\n",
  "status": "failed"
});
formatter.step({
  "name": "the filter gets applied",
  "keyword": "When "
});
formatter.match({
  "location": "stepdefinitions.NCLFilterStepdefinition.the_filter_gets_applied()"
});
formatter.result({
  "status": "skipped"
});
formatter.step({
  "name": "the price of displayed cruises should be within the range",
  "keyword": "Then "
});
formatter.match({
  "location": "stepdefinitions.NCLFilterStepdefinition.the_price_of_displayed_cruises_should_be_within_the_range()"
});
formatter.result({
  "status": "skipped"
});
formatter.embedding("image/png", "embedded0.png", null);
formatter.after({
  "status": "passed"
});
});