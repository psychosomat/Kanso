export type ScanStatus = "idle" | "scanning" | "error";
export type DumpSort = "recent" | "name" | "duration" | "lastPlayed";
export type SortOrder = "asc" | "desc";
export type DumpView = "compact" | "comfortable";
export type PlayerFitMode = "contain" | "cover" | "native";
export type TitlebarMode = "windows" | "macos" | "hidden" | "auto";
export type CategoryFeedSort = "newestPost" | "name" | "lastPlayed";
export type CategoryIconName =
	| "folder"
	| "folders"
	| "star"
	| "heart"
	| "flame"
	| "bolt"
	| "sparkles"
	| "bookmark"
	| "music"
	| "photo"
	| "video"
	| "deviceTv"
	| "rocket"
	| "brain"
	| "ghost"
	| "skull"
	| "sun"
	| "moon"
	| "cloud"
	| "droplet"
	| "leaf"
	| "paw"
	| "diamond"
	| "crown";

export type SourcePathDto = {
	id: string;
	path: string;
	watchEnabled: boolean;
	createdAt: string;
	updatedAt: string;
};

export type LibrarySettingsDto = {
	sourcePaths: SourcePathDto[];
	watchEnabled: boolean;
	lastScanAt: string | null;
	scanStatus: ScanStatus;
	scanError: string | null;
};

export type ScanStatusDto = {
	status: ScanStatus;
	stage: "idle" | "scan" | "watch";
	scannedFiles: number;
	totalFiles: number;
	currentPath: string | null;
	message: string;
	error: string | null;
	updatedAt: string;
};

export type DumpQueryDto = {
	search?: string;
	sort: DumpSort;
	order: SortOrder;
	page: number;
	pageSize: number;
	unsortedOnly?: boolean;
};

export type VideoCardDto = {
	origin: "library";
	id: string;
	fileName: string;
	sourcePath: string;
	folderPath: string;
	durationSec: number | null;
	width: number | null;
	height: number | null;
	modifiedAt: string;
	posterUrl: string | null;
	streamUrl: string;
	resumeSec: number;
	lastPlayedAt: string | null;
	playCount: number;
	exists: boolean;
	categoryCount: number;
};

export type PaginatedVideosDto = {
	items: VideoCardDto[];
	total: number;
	page: number;
	pageSize: number;
};

export type CategoryDto = {
	id: string;
	slug: string;
	name: string;
	description: string | null;
	parentCategoryId: string | null;
	icon: CategoryIconName;
	postCount: number;
	createdAt: string;
	updatedAt: string;
};

export type CategoryOptionDto = {
	id: string;
	slug: string;
	name: string;
	parentCategoryId: string | null;
	icon: CategoryIconName;
	assigned: boolean;
};

export type VideoDetailDto = VideoCardDto & {
	codecVideo: string | null;
	codecAudio: string | null;
	bitrate: number | null;
	fps: number | null;
	fileSize: number;
	categories: CategoryOptionDto[];
	assignedCategoryCount: number;
};

export type ExternalVideoDto = {
	origin: "external";
	id: null;
	fileName: string;
	sourcePath: string;
	folderPath: string;
	durationSec: number | null;
	width: number | null;
	height: number | null;
	modifiedAt: string;
	posterUrl: string | null;
	streamUrl: string;
	resumeSec: number;
	lastPlayedAt: null;
	playCount: number;
	exists: boolean;
	categoryCount: number;
	codecVideo: string | null;
	codecAudio: string | null;
	bitrate: number | null;
	fps: number | null;
	fileSize: number;
	categories: CategoryOptionDto[];
	assignedCategoryCount: number;
};

export type PlayableVideoDto = VideoDetailDto | ExternalVideoDto;

export type CategoryPostDto = {
	id: string;
	caption: string | null;
	createdAt: string;
	category: Pick<CategoryDto, "id" | "slug" | "name" | "icon">;
	video: VideoCardDto;
};

export type PaginatedCategoryPostsDto = {
	category: CategoryDto;
	items: CategoryPostDto[];
	total: number;
	page: number;
	pageSize: number;
};

export type CreateCategoryDto = {
	name: string;
	description?: string;
	parentCategoryId?: string | null;
	icon?: CategoryIconName;
};

export type UpdateCategoryDto = {
	id: string;
	name: string;
	description?: string;
	parentCategoryId?: string | null;
	icon?: CategoryIconName;
};

export type AddVideoToCategoriesDto = {
	videoId: string;
	categories: Array<{
		categoryId: string;
		caption?: string;
	}>;
};

export type RemoveVideoFromCategoryDto = {
	videoId: string;
	categoryId: string;
};

export type PlayerPreferencesDto = {
	dumpSort: DumpSort;
	dumpView: DumpView;
	sidebarCollapsed: boolean;
	titlebarMode: TitlebarMode;
	playerVolume: number;
	playerMuted: boolean;
	playerFitMode: PlayerFitMode;
	playerLoop: boolean;
	speedPresetPrimary: number;
	speedPresetSecondary: number;
	accentColor: string;
	playerEqEnabled: boolean;
	playerEqGains: number[];
};

export type SavePlayerPreferencesDto = Partial<PlayerPreferencesDto>;

export type SaveProgressDto = {
	videoId: string;
	resumeSec: number;
};

export type MarkPlayedDto = {
	videoId: string;
	completed: boolean;
};

export type VideoNativeAction = "open-folder" | "reveal-file" | "copy-path";

export type PlayerApi = {
	app: {
		isElectron: boolean;
		getPlatform(): "win32" | "darwin" | "linux";
		waitForReady(): Promise<void>;
		subscribeOpenVideo(cb: (payload: { filePath: string }) => void): () => void;
	};
	window: {
		minimize(): Promise<void>;
		toggleMaximize(): Promise<void>;
		close(): Promise<void>;
	};
	settings: {
		getLibrary(): Promise<LibrarySettingsDto | null>;
		chooseLibraryFolders(): Promise<LibrarySettingsDto | null>;
		addLibraryFolder(): Promise<LibrarySettingsDto | null>;
		removeLibraryFolder(folderId: string): Promise<LibrarySettingsDto | null>;
		toggleWatchFolder(folderId: string): Promise<LibrarySettingsDto | null>;
	};
	library: {
		getDumpPage(input: DumpQueryDto): Promise<PaginatedVideosDto>;
		getVideo(videoId: string): Promise<VideoDetailDto | null>;
		getExternalVideo(sourcePath: string): Promise<ExternalVideoDto | null>;
		rescanNow(): Promise<void>;
		removeVideo(videoId: string): Promise<void>;
		runVideoAction(videoId: string, action: VideoNativeAction): Promise<void>;
		subscribeScanStatus(cb: (event: ScanStatusDto) => void): () => void;
	};
	categories: {
		list(): Promise<CategoryDto[]>;
		create(input: CreateCategoryDto): Promise<CategoryDto>;
		update(input: UpdateCategoryDto): Promise<CategoryDto>;
		remove(categoryId: string): Promise<void>;
		getFeed(input: {
			categoryId: string;
			page: number;
			pageSize: number;
			sort: CategoryFeedSort;
		}): Promise<PaginatedCategoryPostsDto>;
		getBySlug(slug: string): Promise<CategoryDto | null>;
		addVideo(input: AddVideoToCategoriesDto): Promise<void>;
		removeVideo(input: RemoveVideoFromCategoryDto): Promise<void>;
	};
	player: {
		saveProgress(input: SaveProgressDto): Promise<void>;
		markPlayed(input: MarkPlayedDto): Promise<void>;
		getPreferences(): Promise<PlayerPreferencesDto>;
		savePreferences(input: SavePlayerPreferencesDto): Promise<void>;
	};
};
