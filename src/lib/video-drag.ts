const VIDEO_DRAG_DATA_TYPE = "application/x-kanso-video-id";

export function setDraggedVideoId(dataTransfer: DataTransfer, videoId: string) {
	dataTransfer.effectAllowed = "copy";
	dataTransfer.setData(VIDEO_DRAG_DATA_TYPE, videoId);
	dataTransfer.setData("text/plain", videoId);
}

export function getDraggedVideoId(dataTransfer: DataTransfer) {
	return dataTransfer.getData(VIDEO_DRAG_DATA_TYPE);
}

export function hasDraggedVideo(dataTransfer: DataTransfer) {
	return Array.from(dataTransfer.types).includes(VIDEO_DRAG_DATA_TYPE);
}
