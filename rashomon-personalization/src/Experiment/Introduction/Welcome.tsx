import {IntroProps} from "./interface.ts";
import MarkdownBox from "../../utils/MarkdownBox/MarkdownBox.tsx";
import NextButton from "../../utils/NextButton/NextButton.tsx";
import BackgroundContainer from "../../utils/BackgroundContainer/BackgroundContainer.tsx";
import BoxCol from "../../utils/BoxCol/BoxCol.tsx";
import BoxRow from "../../utils/BoxRow/BoxRow.tsx";


const markdown = `
# Welcome to Our Research Study!

*Estimated completion time: 20 minutes*

## Your Role & Task
As a resource manager at CityRide, you’ll use an AI prediction model to generate valuable insights. This is an 
interactive experience where your choices matter. 

## Compensation
- £3 base compensation plus an additional performance bonus of  £3. 

## Study Structure
1. Generating Insights (10-15 min). You can double your compensation if your prediction is within a certain threshold.
2. Post-survey questionnaire (2-5 min).

## Important Requirements
- Complete all sections in one sitting
- Pass all attention checks throughout the study
- Maintain stable internet connection
- Answer all questions thoughtfully

## Accessibility Note
Feel free to user your browser's controls (typically Ctrl/Cmd + or -) to adjust to adjust the display size for 
comfortable viewing throughout the study.

## Privacy & Data Use
Your responses will be used for research purposes only. All data will be anonymized.


`

const Welcome: React.FC<IntroProps> = ({onNext}) : JSX.Element => {
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

export default Welcome;