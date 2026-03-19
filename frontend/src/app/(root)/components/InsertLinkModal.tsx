'use client';

import { useMemo } from 'react';
import Button from '@/components/Button';
import * as ModalS from '@/components/Modal/styled';
import * as S from '../styled';

import { SubmitHandler, useForm } from 'react-hook-form';
import { REGEX, validateYouTubeUrl } from '@/shared/utils/base';
import { uploadByLink } from '@/shared/apis/video';
import { isEmpty } from 'lodash-es';
import { errorToast } from '@/shared/utils/toastUtils';
import { useRouter } from 'next/navigation';

interface IFormValues {
	input: string;
}

interface Props {
	setIsBusy: (value: boolean) => void;
	onClose: () => void;
}

export default function InsertLinkModal({ setIsBusy, onClose }: Props) {
	const router = useRouter();
	const {
		formState: { errors },
		register,
		handleSubmit,
		watch,
	} = useForm<IFormValues>();

	const onSubmit: SubmitHandler<IFormValues> = async ({ input }) => {
		const trimmedInput = input.trim();
		if (!isEmpty(input) && isEmpty(trimmedInput)) return;

		onClose();
		setIsBusy(true);

		// YouTube URL 검증 및 정규화
		const youtubeValidation = validateYouTubeUrl(trimmedInput);
		const urlToSend = youtubeValidation.isValid ? youtubeValidation.cleanUrl! : trimmedInput;

		console.log('[InsertLinkModal] URL 검증:', {
			original: trimmedInput,
			isYouTube: youtubeValidation.isValid,
			videoId: youtubeValidation.videoId,
			cleanUrl: youtubeValidation.cleanUrl,
			sending: urlToSend
		});

		uploadByLink({ url: urlToSend })
			.then((res) => {
				const { video_id } = res;

				if (video_id) {
					router.push(`/video/${video_id}/summary`);
					return;
				}

				errorToast('영상 업로드에 실패했습니다.');
			})
			.catch((error) => {
				console.log('[파일 업로드 에러]', error);

				// 에러 코드 처리
				if (error?.error_code === 1003) {
					errorToast('영상 길이는 최소 1분 이상이어야 합니다.');
				} else if (error?.error_code === 1008) {
					errorToast('영상 길이는 최대 45분까지 업로드 가능합니다.');
				} else if (error?.error_code === 1002) {
					errorToast('파일 크기가 500MB를 초과합니다.');
				} else if (error?.error_code >= 1700 && error?.error_code <= 1706) {
					errorToast('YouTube 영상 다운로드에 실패했습니다. 비공개 영상이거나 지역 제한이 있을 수 있습니다.');
				} else {
					errorToast('영상 업로드에 실패했습니다.');
				}
			})
			.finally(() => {
				setIsBusy(false);
			});
	};

	const watchInput = watch('input');
	const isValidUrl = useMemo(() => {
		const urlPattern = REGEX.url;
		return watchInput ? urlPattern.test(watchInput) : false;
	}, [watchInput]);

	return (
		<S.InsertLinkForm onSubmit={handleSubmit(onSubmit)}>
			<ModalS.SharedModalHeader>
				<ModalS.SharedModalTitle as="h3">링크 삽입</ModalS.SharedModalTitle>
				<ModalS.SharedModalDescription>YouTube URL 또는 일반 링크를 입력해 영상을 불러옵니다.</ModalS.SharedModalDescription>
			</ModalS.SharedModalHeader>

			<S.LinkInput
				{...register('input', {
					required: '링크를 입력해주세요.',
					pattern: {
						value: REGEX.url,
						message: '유효한 URL을 입력해주세요. (예: https://www.youtube.com/watch?v=...)',
					},
				})}
				placeholder="YouTube URL 또는 일반 URL을 입력하세요."
				error={!!errors.input}
			/>

			{errors.input && <S.ErrorMessage>{errors.input.message}</S.ErrorMessage>}

			<ModalS.SharedModalFooter>
				<Button type="button" status="neutral_outlined" onClick={onClose} width={88}>
					취소
				</Button>
				<Button type="submit" status="primary" width={88} disabled={!isValidUrl}>
					적용
				</Button>
			</ModalS.SharedModalFooter>
		</S.InsertLinkForm>
	);
}
