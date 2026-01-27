export const ACCEPTED_VIDEO_TYPES = {
	'video/mp4': ['.mp4'],
	'video/quicktime': ['.mov'],
	'video/x-ms-wmv': ['.wmv'],
	'video/x-msvideo': ['.avi'],
};

export const ACCEPTED_IMAGE_TYPES = {
	'image/jpeg': ['.jpg', '.jpeg'],
	'image/png': ['.png'],
};

export const validateFileTypes = (files: File[]) => {
	const validExtensions = /\.(mp4|mov|wmv|avi)$/i;
	return files.every((file) => validExtensions.test(file.name));
};

export const validateFileTypes2 = (files: File[]) => {
	return files.every((file) => Object.keys(ACCEPTED_VIDEO_TYPES).includes(file.type));
};

export const validateImageFileTypes = (files: File[]) => {
	const validExtensions = /\.(jpg|jpeg|png)$/i;
	return files.every((file) => validExtensions.test(file.name));
};
