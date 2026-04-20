import {
	createContext,
	type PropsWithChildren,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import type {
	CategoryDto,
	LibrarySettingsDto,
	PlayerPreferencesDto,
	SavePlayerPreferencesDto,
	ScanStatusDto,
} from "@/lib/contracts";
import { getPlayerApi } from "@/lib/player-api";

type AppStateContextValue = {
	library: LibrarySettingsDto | null;
	categories: CategoryDto[];
	preferences: PlayerPreferencesDto | null;
	scanStatus: ScanStatusDto | null;
	loading: boolean;
	refreshAll: () => Promise<void>;
	refreshCategories: () => Promise<void>;
	refreshLibrary: () => Promise<void>;
	refreshPreferences: () => Promise<void>;
	savePreferences: (input: SavePlayerPreferencesDto) => Promise<void>;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: PropsWithChildren) {
	const [library, setLibrary] = useState<LibrarySettingsDto | null>(null);
	const [categories, setCategories] = useState<CategoryDto[]>([]);
	const [preferences, setPreferences] = useState<PlayerPreferencesDto | null>(
		null,
	);
	const [scanStatus, setScanStatus] = useState<ScanStatusDto | null>(null);
	const loading = !preferences || !library;

	const refreshLibrary = useCallback(async () => {
		const api = getPlayerApi();
		setLibrary(await api.settings.getLibrary());
	}, []);

	const refreshCategories = useCallback(async () => {
		const api = getPlayerApi();
		setCategories(await api.categories.list());
	}, []);

	const refreshPreferences = useCallback(async () => {
		const api = getPlayerApi();
		setPreferences(await api.player.getPreferences());
	}, []);

	const savePreferences = useCallback(
		async (input: SavePlayerPreferencesDto) => {
			const api = getPlayerApi();
			await api.player.savePreferences(input);
			setPreferences((current) =>
				current ? { ...current, ...input } : current,
			);
		},
		[],
	);

	const refreshAll = useCallback(async () => {
		try {
			const prefsPromise = refreshPreferences();
			const libPromise = refreshLibrary();
			const catsPromise = refreshCategories();
			await Promise.all([prefsPromise, libPromise, catsPromise]);
		} finally {
			// cleanup if needed
		}
	}, [refreshCategories, refreshLibrary, refreshPreferences]);

	useEffect(() => {
		if (typeof window === "undefined" || !window.playerApi) return;
		let cancelled = false;
		let unsubscribe: (() => void) | undefined;

		void Promise.all([refreshPreferences(), refreshLibrary()])
			.then(() => {
				if (!cancelled) {
					// Data loaded
				}
			})
			.finally(() => {
				void refreshCategories();
			});

		unsubscribe = getPlayerApi().library.subscribeScanStatus((event) => {
			setScanStatus(event);
			void refreshLibrary();
		});

		return () => {
			cancelled = true;
			unsubscribe?.();
		};
	}, [refreshLibrary, refreshCategories, refreshPreferences]);

	const value = useMemo(
		() => ({
			library,
			categories,
			preferences,
			scanStatus,
			loading,
			refreshAll,
			refreshCategories,
			refreshLibrary,
			refreshPreferences,
			savePreferences,
		}),
		[
			categories,
			library,
			preferences,
			loading,
			scanStatus,
			refreshAll,
			refreshCategories,
			refreshLibrary,
			refreshPreferences,
			savePreferences,
		],
	);

	return (
		<AppStateContext.Provider value={value}>
			{children}
		</AppStateContext.Provider>
	);
}

export function useAppState() {
	const value = useContext(AppStateContext);
	if (!value) {
		throw new Error("useAppState must be used inside AppStateProvider.");
	}
	return value;
}
