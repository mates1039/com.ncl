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


    @FindBy(xpath = "//div[@data-code='destination']") ////div[@data-code='destination']
    public WebElement destinationDropDown;

    @FindBy(xpath = "//input[starts-with(@placeholder, 'Find a Des')]")
    public WebElement searchDestinationBox;

    //@FindBy (xpath = "//input[@id='c80_checkboxHAWAII']")//#c80_checkboxHAWAII
    @FindBy(xpath= "//span[contains(text(),'Hawaii Cruises')]") //
    public WebElement hawaiiRadioButton;

    @FindBy (xpath = "//a[@title='Apply' and @class='link-2']")
    public WebElement applyButton;

    @FindBy(xpath = "//a[@data-action='find-a-cruise']")
    public WebElement findCruiseButton;

    @FindBy(css = "#simplemodal-close-img")
    public WebElement alertDismiss;
// //*[Aclass='featured']//*[text()='Testing']   //a[starts-with(@href, "mylink")]

   public void navigateToHomePage() {
        Driver.getDriver().get(ConfigurationReader.getProperty("ncl_url"));
    }


}
