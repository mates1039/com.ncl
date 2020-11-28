package stepdefinitions;

import io.cucumber.java.en.Given;
import org.openqa.selenium.By;
import org.openqa.selenium.NoAlertPresentException;
import pages.NCLFilterPage;
import pages.NCLHomePage;
import utilities.Driver;
import utilities.TestBase;

public class NCLHomePageStepdefinition extends TestBase {

    NCLHomePage nclHomePage = new pages.NCLHomePage();
    NCLFilterPage filterPage=new NCLFilterPage();

    @Given("User navigates to ncl.com")
    public void user_navigates_to_ncl_com() {
        nclHomePage.navigateToHomePage();
        System.out.println();
    }


    @Given("User searches for {string}")
    public void user_searches_for(String string)  {
        nclHomePage.destinationDropDown.click();
        nclHomePage.searchDestinationBox.sendKeys(string);
        nclHomePage.hawaiiCruise.click();
        nclHomePage.applyButton.click();
        nclHomePage.findCruiseButton.click();

        TestBase.waitForPageToLoad(20);

        try{
            Driver.getDriver().switchTo().alert().dismiss();

        } catch(NoAlertPresentException e){}

        if (Driver.getDriver().findElement(By.id("simplemodal-close-img")).isDisplayed()){
            Driver.getDriver().findElement(By.id("simplemodal-close-img")).click();
        }



    }
}
