package stepdefinitions;

import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import pages.NCLFilterPage;
import utilities.TestBase;

public class NCLFilterStepdefinition extends TestBase {

    NCLFilterPage filterPage = new NCLFilterPage();

    @Given("User filters result by price range from $0 to $1500")
    public void user_filters_result_by_price_range_from_$0_to_$1500() {
filterPage.moreFiltersButton.click();
//dismissAlert();
        filterPage.lowestPrice.sendKeys("0");
        filterPage.highestPrice.sendKeys("1500");
    }

    @When("the filter gets applied")
    public void the_filter_gets_applied() {

    }

    @Then("the price of displayed cruises should be within the range")
    public void the_price_of_displayed_cruises_should_be_within_the_range() {

    }


}
