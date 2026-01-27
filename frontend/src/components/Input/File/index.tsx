import { useModal } from '@/shared/hooks';
import React, { FC, useMemo } from 'react';
import { UseFormRegister } from 'react-hook-form';

import { isEmpty, isNil, isUndefined } from 'lodash-es';
import * as S from './styled';

interface IProps {
	multiple?: boolean;
	id: string;
	name?: string;
	label?: string;
	selectedFile: any[] | null;
	handleUpload: (file: FileList) => void;
	removeTargetFile: (name: string, type: 'new' | 'old') => void;
	register?: UseFormRegister<any>;

	width?: number;
	height?: number;

	//
	required?: boolean;

	accept?: string;
}

const InputFileForm: FC<IProps> = ({
	multiple = false,
	id,
	name,
	label,
	selectedFile,
	handleUpload,
	removeTargetFile,
	register,

	width,
	height,

	//

	required = false,

	accept = '',
}) => {
	/**
	 * States
	 */
	const { failAlert } = useModal();

	/**
	 * Queries
	 */

	/**
	 * Side-Effects
	 */

	/**
	 * Handlers
	 */

	const handleChangeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
		e.preventDefault();
		const { files } = e.target;
		if (files && files.length) {
			handleUpload(files);
		} else failAlert('파일을 선택해주세요');
	};

	/**
	 * Helpers
	 */
	const isFileName = () => {
		return selectedFile && selectedFile.length ? `${selectedFile.length} 건의 파일` : '선택된 파일 없음';
	};

	const isRegister = useMemo(
		() =>
			register &&
			name && {
				...register(name, {
					onChange: (e) => {
						handleChangeFile(e);
					},
				}),
			},
		[register, name],
	);

	return (
		<S.FileSection>
			{label && <S.Label $required={required}>{label}</S.Label>}

			<S.FileBox $width={width} $height={height}>
				<S.FileLabel htmlFor={id}>파일 선택</S.FileLabel>
				<S.FileText $isActive={!!selectedFile}>{isFileName()}</S.FileText>
			</S.FileBox>

			<S.FileInput
				{...isRegister}
				type="file"
				id={id}
				accept={accept}
				multiple={multiple}
				onChange={(e) => handleChangeFile(e)}
			/>

			{!isNil(selectedFile) && !isEmpty(selectedFile) && (
				<S.FileList>
					{Array.from(selectedFile).map((o) => {
						const isNewFile = isUndefined(o.id);
						const key = isNewFile ? `${o.name}_${o.lastModified}` : o.id;
						const fileName = isNewFile ? o.name : o.filename;
						return (
							<S.FileItem key={key}>
								<S.FileItemText>{fileName}</S.FileItemText>
								<S.FileItemCloseBox>
									{/* FIXMe <Image /> 태그 정상화하기 */}
									{/* <Image src="ic_close.webp" onClick={() => removeTargetFile(fileName, isNewFile ? 'new' : 'old')} /> */}
								</S.FileItemCloseBox>
							</S.FileItem>
						);
					})}
				</S.FileList>
			)}
		</S.FileSection>
	);
};

export default InputFileForm;
