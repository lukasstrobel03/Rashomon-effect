import React from 'react';
import styles from './index.module.css';
import { ChevronRight, Loader2 } from 'lucide-react';

interface NextButtonProps {
    isValid: boolean;
    onNext: () => void;
    isLoading?: boolean;
    label?: string;
}

const NextButton: React.FC<NextButtonProps> = ({ 
    isValid, 
    onNext,
    label = 'Please complete the form',
    isLoading = false
}) => {
    return (
        <div className={styles.container}>
            <div className={styles.btnHolder}>
                <button
                    className={styles.nextButton}
                    onClick={onNext}
                    disabled={!isValid || isLoading}
                    aria-label={!isValid ? "Complete all required fields to proceed" : "Proceed to next step"}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className={styles.spinner} size={20}/>
                            Processing...
                        </>
                    ) : (
                        <>
                            {!isValid ? label : 'Submit'}
                            <ChevronRight size={20}/>
                        </>
                    )}
                </button>

            </div>
        </div>
    );
};

export default NextButton