@ncl
Feature: NCL navigate page

  Background: User navigates to ncl.com
    Given User navigates to ncl.com

  Scenario: User filters cruises by destination and price
    Given User searches for "Hawaii Cruises"
    And User filters result by price range from $0 to $1500
    When the filter gets applied
    Then the price of displayed cruises should be within the range

