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
  "status": "passed"
});
formatter.step({
  "name": "the filter gets applied",
  "keyword": "When "
});
formatter.match({
  "location": "stepdefinitions.NCLFilterStepdefinition.the_filter_gets_applied()"
});
formatter.result({
  "status": "passed"
});
formatter.step({
  "name": "the price of displayed cruises should be within the range",
  "keyword": "Then "
});
formatter.match({
  "location": "stepdefinitions.NCLFilterStepdefinition.the_price_of_displayed_cruises_should_be_within_the_range()"
});
formatter.result({
  "status": "passed"
});
formatter.after({
  "status": "passed"
});
});