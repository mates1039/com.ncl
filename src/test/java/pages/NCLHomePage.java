package pages;

import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.FindBy;
import org.openqa.selenium.support.PageFactory;
import utilities.ConfigurationReader;
import utilities.Driver;

public class NCLHomePage {

    public NCLHomePage() {
        PageFactory.initElements(Driver.getDriver(), this);
    }


    @FindBy(xpath = "//div[@data-code='destination']")
    public WebElement destinationDropDown;

    @FindBy(xpath = "//input[starts-with(@placeholder, 'Find a Des')]")
    public WebElement searchDestinationBox;

    @FindBy(xpath= "//span[contains(text(),'Hawaii Cruises')]") //
    public WebElement hawaiiCruise;

    @FindBy (xpath = "//a[@title='Apply' and @class='link-2']")
    public WebElement applyButton;

    @FindBy(xpath = "//a[@data-action='find-a-cruise']")
    public WebElement findCruiseButton;

    @FindBy(css = "#simplemodal-close-img")
    public WebElement alertDismiss;


   public void navigateToHomePage() {
        Driver.getDriver().get(ConfigurationReader.getProperty("ncl_url"));
    }


}
