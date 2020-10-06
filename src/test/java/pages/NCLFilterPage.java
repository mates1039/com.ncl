package pages;

import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.FindBy;
import org.openqa.selenium.support.PageFactory;
import utilities.Driver;

import java.util.List;

public class NCLFilterPage {

    public NCLFilterPage() {
        PageFactory.initElements(Driver.getDriver(), this);
    }
@FindBy(css=".ngi-icon-times-thin")
public WebElement popupClose;

@FindBy(id="submit_signup")
public WebElement popupSubmit;

    @FindBy(xpath = "//span[contains(text(),'More Filters')]")
    public WebElement moreFiltersButton;

    @FindBy(xpath = "//input[@type='number' and @aria-label='Lowest Price']")
    public WebElement lowestPrice;

    @FindBy(xpath = "//input[@type='number' and @aria-label='Highest Price']")
    public WebElement highestPrice;

    @FindBy(xpath = "(//a[@data-action='apply' and @title='Apply'])[12]")
    public WebElement applyButton;

    @FindBy(xpath = "//span[@class='headline-1 -variant-3']")
    public List<WebElement> listOfPrices;


}


