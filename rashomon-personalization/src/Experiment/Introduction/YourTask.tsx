import MarkdownBox from "../../utils/MarkdownBox/MarkdownBox.tsx";
import NextButton from "../../utils/NextButton/NextButton.tsx";
import BackgroundContainer from "../../utils/BackgroundContainer/BackgroundContainer.tsx";
import {IntroProps} from "./interface.ts";

const markdown = `
As CityRide's Resource Manager, you've learned how to interpret different types of effect plots. Now, it's time to customize your AI prediction model.

## Why Personalize?
1. Multiple **different AI prediction models can achieve equally good predictions** for CityRide’s data
2. Effect **plots can vary greatly** depending on the underlying model
3. The number of plots can range from very few to many
4. Different configurations may better suit **your analysis style**

## Your Task

CityRide is offering you the chance to find the perfect configuration to support your work. You'll:
1. Review various effect plot configurations
2. Provide an estimate of the number of bikes rented on the selected day
3. Our system will select the best-suiting configuration based on your estimations

Remember: Your goal is to choose a configuration that will best help you generate 5 insightful observations about 
bike-sharing patterns

By personalizing your AI prediction model with different effect plot configurations, you're setting yourself up for 
success in maximizing your bonus potential!

Click 'Next' to begin exploring different effect plot configurations.
`

const YourTask: React.FC<IntroProps> = ({onNext}): JSX.Element => {
    return (
        <BackgroundContainer>
            <MarkdownBox markdown={markdown}/>
            <NextButton
                onNext={onNext}
                isValid={true}
            />
        </BackgroundContainer>
    )
}

export default YourTask;
