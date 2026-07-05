const VIDEO_DRAG_DATA_TYPE = "application/x-kanso-video-id";
const POST_DRAG_DATA_TYPE = "application/x-kanso-post-id";

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

export function setDraggedPostId(dataTransfer: DataTransfer, postId: string) {
	dataTransfer.effectAllowed = "move";
	dataTransfer.setData(POST_DRAG_DATA_TYPE, postId);
	dataTransfer.setData("text/plain", postId);
}

export function getDraggedPostId(dataTransfer: DataTransfer) {
	return dataTransfer.getData(POST_DRAG_DATA_TYPE);
}

export function hasDraggedPost(dataTransfer: DataTransfer) {
	return Array.from(dataTransfer.types).includes(POST_DRAG_DATA_TYPE);
}
