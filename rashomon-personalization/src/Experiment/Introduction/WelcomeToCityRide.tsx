import {IntroProps} from "./interface.ts";
import MarkdownBox from "../../utils/MarkdownBox/MarkdownBox.tsx";
import NextButton from "../../utils/NextButton/NextButton.tsx";
import BackgroundContainer from "../../utils/BackgroundContainer/BackgroundContainer.tsx";
import BoxCol from "../../utils/BoxCol/BoxCol.tsx";
import BoxRow from "../../utils/BoxRow/BoxRow.tsx";


const markdown = `
# Welcome to CityRide 🚲

## Your New Role

As CityRide's Resource Manager, you’ll generate insights for your supervisor using an AI prediction model. To 
familiarize you with the AI prediction model, we’ll start with a simple example: predicting ice cream sales.

## What You'll Learn
1. How to read and interpret prediction visualizations
2. Ways to identify important patterns in data
3. Methods to generate confident, data-backed insights

`

const WelcomeToCityRide: React.FC<IntroProps> = ({onNext}) : JSX.Element => {
    return (
        <BackgroundContainer>
            <div>
                <BoxCol>
                    <BoxRow>
                        <MarkdownBox markdown={markdown}/>
                    </BoxRow>
                </BoxCol>
                <NextButton onNext={onNext} isValid={true}/>
            </div>
        </BackgroundContainer>
    )
}

export default WelcomeToCityRide;