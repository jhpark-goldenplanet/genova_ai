import { useEffect, useState } from 'react';
import { usePopper } from 'react-popper';

const useCustomPopper = () => {
	const [isPopperOpen, setIsPopperOpen] = useState(false);
	const [referenceElement, setReferenceElement] = useState<HTMLButtonElement | null>(null);
	const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);

	const { styles, attributes } = usePopper(referenceElement, popperElement, {
		placement: 'bottom',
		modifiers: [
			{
				name: 'offset',
				options: {
					offset: [0, 16],
				},
			},
		],
	});

	useEffect(() => {
		if (!isPopperOpen) return;

		const handleDocumentClick = (event: MouseEvent) => {
			const target = event.target as Node;
			// 클릭된 대상이 referenceElement나 popperElement 내부가 아니라면 popper를 닫음
			if (referenceElement && popperElement && !referenceElement.contains(target) && !popperElement.contains(target)) {
				setIsPopperOpen(false);
			}
		};

		document.addEventListener('click', handleDocumentClick);
		return () => {
			document.removeEventListener('click', handleDocumentClick);
		};
	}, [isPopperOpen, referenceElement, popperElement]);

	return { styles, attributes, isPopperOpen, setIsPopperOpen, setReferenceElement, setPopperElement };
};

export default useCustomPopper;
