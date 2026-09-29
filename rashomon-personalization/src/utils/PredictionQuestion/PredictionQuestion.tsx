import React, {useState, useCallback} from "react";
import rawBikeSharingDays from "./assets/bikesharing_day.json";
import rawBikeSharingHours from "./assets/bikesharing_hour.json";
import MarkdownBox from "../MarkdownBox/MarkdownBox.tsx";
import ValidatedInput from "../ValidatedInput/ValidatedInput.tsx";
import * as Yup from "yup";
import {InferType, ValidationError} from "yup";
import NextButton from "../NextButton/NextButton.tsx";
import {DashboardData} from "../../Experiment/Personalization/data.tsx";

const formSchema = Yup.object().shape({
    estimate: Yup.number()
        .required("Input required.")
    .min(0, "Please enter a non-negative number.")
        .typeError("Please enter a valid number.")
});

type FormSchema = InferType<typeof formSchema>;

interface PredictionQuestionProps {
    plotData?: DashboardData[]
    onSubmit: (estimate: number, groundTruth: number, modelPrediction: number) => void
}

interface RawBikeSharingDay {
    temp: number; // normalized temperature
    atemp: number; // normalized feeling temperature
    windspeed: number;
    weekday: number; // 0 (Sunday) - 6 (Saturday)
    workingday: number;
    season: number;
    cnt: number;
}

interface RawBikeSharingHour extends RawBikeSharingDay {
    hr: number;
}

type Weekday = "Sunday" | "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday";
type Season = "Spring" | "Summer" | "Fall" | "Winter";

interface BikeSharingDay extends Omit<RawBikeSharingDay, 'weekday' | 'season' | 'workingday'> {
    weekday: Weekday;
    season: Season;
    workingday: boolean;
}

interface BikeSharingHour extends BikeSharingDay {
    hr: number;
}

// Mappings to lookup weekday and season names
const weekdayLookup = {
    0: "Sunday" as const,
    1: "Monday" as const,
    2: "Tuesday" as const,
    3: "Wednesday" as const,
    4: "Thursday" as const,
    5: "Friday" as const,
    6: "Saturday" as const,
} as Record<string, Weekday>;

const seasonLookup = {
    1: "Spring" as const,
    2: "Summer" as const,
    3: "Fall" as const,
    4: "Winter" as const,
} as Record<string, Season>;

function processBikeSharingDayData(rawBikeSharingDay: RawBikeSharingDay): BikeSharingDay {
    return {
        ...rawBikeSharingDay,
        weekday: weekdayLookup[rawBikeSharingDay.weekday.toString()],
        season: seasonLookup[rawBikeSharingDay.season.toString()],
        workingday: rawBikeSharingDay.workingday === 1,
    };
}

function processBikeSharingHourData(rawBikeSharingHour: RawBikeSharingHour): BikeSharingHour {
    return {
        ...rawBikeSharingHour,
        weekday: weekdayLookup[rawBikeSharingHour.weekday.toString()],
        season: seasonLookup[rawBikeSharingHour.season.toString()],
        workingday: rawBikeSharingHour.workingday === 1,
    };
}

function fmtBikeSharingHour(hour: BikeSharingHour) : string {
    const workdayEntry = hour.workingday ? "Yes" : "No"
    const tempEntry = (hour.atemp * (50+16) -16).toFixed(2)
    const windEntry = (hour.windspeed).toFixed(2)
    const mdTable = `
| Weekday         | Workday         | Time       | Temperature  | Wind Speed   |
| :---------------| :-------------- | :--------- | :----------- | :----------- |
| ${hour.weekday} | ${workdayEntry} | ${hour.hr} | ${tempEntry} | ${windEntry} |
`
    return mdTable
}

//@ts-expect-error ignore redundant daily data
const bikesharingDays: Array<BikeSharingDay> = rawBikeSharingDays.map(processBikeSharingDayData);
const bikesharingHours: Array<BikeSharingHour> = (rawBikeSharingHours as Array<RawBikeSharingHour>).map(processBikeSharingHourData)

function interpolate(x: number, values: number[], scores: number[]): number {
    if (x <= values[0]) return scores[0];
    if (x >= values[values.length - 1]) return scores[scores.length - 1];
    const upper = values.findIndex((value) => value >= x);
    const lower = upper - 1;
    const ratio = (x - values[lower]) / (values[upper] - values[lower]);
    return scores[lower] + ratio * (scores[upper] - scores[lower]);
}

function getFeatureValue(feature: string, hour: BikeSharingHour): number | string {
    if (feature === "Time") return hour.hr;
    if (feature === "Temperature") return hour.atemp * 66 - 16;
    if (feature === "Weekday") return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
        Object.keys(weekdayLookup).findIndex((key) => weekdayLookup[key] === hour.weekday)
    ];
    if (feature === "Workday") return hour.workingday ? 1 : 0;
    return 0;
}

function getCategoricalScore(data: DashboardData, value: number | string): number {
    const index = data.X.findIndex((entry) => String(entry) === String(value));
    return data.Y[index >= 0 ? index : 0];
}

function getInteractionScore(data: DashboardData, hour: BikeSharingHour): number {
    const [left, right] = data.feat_name.split(" x ");
    const leftValue = getFeatureValue(left, hour);
    const rightValue = getFeatureValue(right, hour);
    const leftIndex = Math.max(0, Math.min(data.X.length - 2, data.X.findIndex((value) => Number(value) > Number(leftValue)) - 1));
    const rightIndex = Math.max(0, Math.min(data.Y.length - 2, data.Y.findIndex((value) => Number(value) > Number(rightValue)) - 1));
    return data.Z?.[rightIndex]?.[leftIndex] ?? 0;
}

function calculateModelPrediction(plotData: DashboardData[], hour: BikeSharingHour): number {
    return plotData.reduce((prediction, data) => {
        if (data.type === "interaction") return prediction + getInteractionScore(data, hour);
        if (data.type === "categorical") return prediction + getCategoricalScore(data, getFeatureValue(data.feat_name, hour));
        return prediction + interpolate(Number(getFeatureValue(data.feat_name, hour)), data.X, data.Y);
    }, 0);
}

const PredictionQuestion: React.FC<PredictionQuestionProps> = ({onSubmit, plotData}) => {

    const [formData, setFormData] = useState<Partial<FormSchema>>({
        estimate: undefined
    });


    const validateField = (field: keyof FormSchema, value: string) => {
        try {
            const fieldSchema = Yup.reach(formSchema, field) as Yup.Schema
            fieldSchema.validateSync(value)
            return { isValid: true, error: null };
        } catch (err) {
            if (err instanceof ValidationError) {
                return { isValid: false, error: err.message };
            }
            return { isValid: false, error: 'Validation failed' };
        }
    };

    const isFormValid = useCallback((): boolean => {
        try {
            formSchema.validateSync(formData, { abortEarly: false });
            return true;
        } catch (err) {
            return false;
        }
    }, [formData]);


    const handleFieldChange = (field: keyof FormSchema) => (value: string): void => {
        setFormData(prev => ({
            ...prev,
            [field]: value === '' ? undefined : Number(value)
        }));
    };

    const shuffledHours = React.useMemo(
        () => [...bikesharingHours].sort(() => Math.random() - 0.5),
        [bikesharingHours]
    );
    const [currentIndex, setCurrentIndex] = useState(0);

    const currentHour = shuffledHours[currentIndex];
    const nextHour = () => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % shuffledHours.length);
        setFormData({ estimate: undefined });
    };


    return (
        <div>
            <h2>How many bikes do you estimate to be rented on the following day?</h2>
            <MarkdownBox markdown={fmtBikeSharingHour(currentHour)}/>

            <div>
                <ValidatedInput
                    key={`${currentIndex}-${currentHour.weekday}-${currentHour.hr}`}
                    placeholder={"Enter your estimate here"}
                    validate={(value) => validateField("estimate", value)}
                    onChange={handleFieldChange("estimate")}
                    indicatedValidInput={false}
                />
                <NextButton
                    onNext={() => {
                        onSubmit(formData.estimate as number, currentHour.cnt, calculateModelPrediction(plotData ?? [], currentHour))
                        nextHour()
                    }}
                    isValid={isFormValid()}
                    label={"Please enter your estimate."}
                />
            </div>

        </div>
    );
};

export default PredictionQuestion;