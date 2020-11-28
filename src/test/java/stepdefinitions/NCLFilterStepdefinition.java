package stepdefinitions;

import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.junit.Assert;
import org.openqa.selenium.WebElement;
import pages.NCLFilterPage;
import utilities.TestBase;

public class NCLFilterStepdefinition extends TestBase {

    NCLFilterPage filterPage = new NCLFilterPage();

    @Given("User filters result by price range from $0 to $1500")
    public void user_filters_result_by_price_range_from_$0_to_$1500() {
        filterPage.moreFiltersButton.click();
        filterPage.lowestPrice.sendKeys("1"); //bug
        filterPage.highestPrice.sendKeys("1500");
        filterPage.applyButton.click();

    }



    @When("the filter gets applied")
    public void the_filter_gets_applied() {


        System.out.println(filterPage.moreFiltersTextArea.getText().length());
        if (filterPage.moreFiltersTextArea.getText().length()<=12){
            System.out.println(filterPage.moreFiltersTextArea.getText());
            Assert.fail();
        }

    }

    @Then("the price of displayed cruises should be within the range")
    public void the_price_of_displayed_cruises_should_be_within_the_range() {
        int prices;
        String originalPrices="";
        for (WebElement element:filterPage.listOfPrices){
            System.out.println(element.getText());
            originalPrices=element.getText().substring(1).replace(",","");
            prices=Integer.parseInt(originalPrices);
            System.out.println(prices);
            Assert.assertTrue(prices>=0&&prices<=1500);



        }
    }


}
