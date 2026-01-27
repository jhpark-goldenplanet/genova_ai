'use client';

import * as S from '../styled';

import { SubmitHandler, useForm } from 'react-hook-form';
import { errorToast } from '@/shared/utils/toastUtils';
import { isEmpty, uniqBy } from 'lodash-es';
import { FileRejection, useDropzone } from 'react-dropzone';
import { ACCEPTED_IMAGE_TYPES, validateImageFileTypes } from '@/app/(root)/helper';
import { useModal } from '@/shared/hooks';

interface IFormValues {
	files: any;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILE_LENGTH = 1;

interface Props {
	splitAndDownloadVideo: (img_file?: File) => void;
	onClose: () => void;
}

export default function AddThumbnailModal({ splitAndDownloadVideo, onClose }: Props) {
	const { confirm, closeConfirm } = useModal();
	const { register, handleSubmit, setValue, watch } = useForm<IFormValues>();
	const watchFiles: File[] = watch('files');

	const handleLoadFiles = (files: File[]) => {
		if (files?.length) {
			const newFiles = uniqBy([...watchFiles, ...files], 'lastModified');

			if (newFiles.length > MAX_FILE_LENGTH) {
				setValue('files', watchFiles);
				errorToast(`파일은 최대 1개까지 첨부 가능합니다.`);
				return;
			}

			setValue('files', newFiles);
			handleSubmit(onSubmit)();
		}
	};

	const handleDropRejected = (fileRejections: FileRejection[]) => {
		const { code, message } = fileRejections[0].errors[0];

		switch (code) {
			case 'file-invalid-type':
				errorToast('PNG, JPG, JPEG 형식의 이미지만 업로드 가능합니다.');
				break;
			case 'file-too-large':
				errorToast('파일은 최대 50MB까지 첨부 가능합니다.');
				break;
			default:
				errorToast(message);
		}
	};

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop: handleLoadFiles,
		onDropRejected: handleDropRejected,
		accept: ACCEPTED_IMAGE_TYPES,
		maxSize: MAX_FILE_SIZE,
		noClick: true,
		multiple: false,
	});

	const handleChangeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
		e.preventDefault();

		const { files: fileList } = e.target;
		const hasSelectedFiles = !isEmpty(watchFiles);

		if ((fileList?.length ?? 0) > MAX_FILE_LENGTH) {
			setValue('files', hasSelectedFiles ? watchFiles : []);
			errorToast(`파일은 최대 ${MAX_FILE_LENGTH}개까지 첨부 가능합니다.`);
			return;
		}

		if (fileList?.length) {
			const files = [...Array.from(fileList)];
			handleLoadFiles(files);
		}
	};

	const onSubmit: SubmitHandler<IFormValues> = async ({ files }) => {
		onClose();
		splitAndDownloadVideo(files[0]);
	};

	const isRegister = register('files', {
		onChange: handleChangeFile,
		validate: {
			maxFiles: (files) => files.length <= MAX_FILE_LENGTH || `파일은 최대 ${MAX_FILE_LENGTH}개까지 첨부 가능합니다.`,
			maxFileSize: (files) => {
				if (isEmpty(files)) return true;
				const fileSizeValid = files.every((file: File) => file.size <= MAX_FILE_SIZE);
				return fileSizeValid || '파일은 최대 50MB까지 첨부 가능합니다.';
			},
			fileType: (files) => {
				if (isEmpty(files)) return true;
				return validateImageFileTypes(files) || 'PNG, JPG, JPEG 파일만 업로드 가능합니다.';
			},
		},
	});

	return (
		<S.AddThumbnailContainer {...getRootProps()}>
			<input {...getInputProps()} />
			<h3>{`분할된 클립 영상의 썸네일을 등록하여\n영상을 더욱 돋보이게 만들어 보세요!`}</h3>

			<S.DragAndDropWrapper isDragActive={isDragActive} onSubmit={handleSubmit(onSubmit)}>
				<h5>업로드할 파일 놓기</h5>
				<p>(최대 50MB 이하, jpg,jpeg, png 첨부가능)</p>
				<S.UploadButton htmlFor="thumbnail-file">이미지 가져오기</S.UploadButton>
				<input
					{...isRegister}
					name="files"
					type="file"
					id="thumbnail-file"
					accept=".jpg,.jpeg,.png"
					multiple={false}
					style={{ display: 'none' }}
				/>
			</S.DragAndDropWrapper>

			<S.LinkInsertButtonWrapper>
				<button type="button" onClick={onClose}>
					취소
				</button>
				<button
					type="button"
					onClick={() => {
						confirm({
							message: '썸네일을 등록하지 않고 분할된 영상을 다운로드하시겠습니까?',
							okHandler: () => {
								onClose();
								closeConfirm();
								splitAndDownloadVideo();
							},
						});
					}}
				>
					다음
				</button>
			</S.LinkInsertButtonWrapper>
		</S.AddThumbnailContainer>
	);
}
