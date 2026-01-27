import { useRef } from 'react';

const useStopwatch = (milliSeconds: number) => {
	const endTime = useRef(0);

	const startStopwatch = () => {
		endTime.current = Date.now() + milliSeconds;
	};

	const isFinishStopwatch = () => {
		return endTime.current === 0 || Date.now() > endTime.current;
	};

	return { startStopwatch, isFinishStopwatch };
};

export default useStopwatch;
