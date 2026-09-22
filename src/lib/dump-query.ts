import type {
	DuplicateGroupDto,
	DumpQueryDto,
	DumpSort,
	DurationBucketName,
	ResolutionBucketName,
	SortOrder,
	WatchedFilter,
} from "./contracts";

export type DumpFilterState = {
	search: string;
	sort: DumpSort;
	order: SortOrder;
	pageSize: number;
	watched: WatchedFilter;
	resolution: "all" | ResolutionBucketName;
	durationBucket: "all" | DurationBucketName;
	codec: string;
};

export function buildDumpQuery(filters: DumpFilterState): DumpQueryDto {
	return {
		search: filters.search,
		sort: filters.sort,
		order: filters.order,
		page: 1,
		pageSize: filters.pageSize,
		unsortedOnly: true,
		watched: filters.watched,
		resolutions:
			filters.resolution === "all" ? undefined : [filters.resolution],
		codecVideo: filters.codec.trim() || undefined,
		durationBuckets:
			filters.durationBucket === "all" ? undefined : [filters.durationBucket],
	};
}

export function hasActiveDumpFilters(filters: {
	search: string;
	watched: WatchedFilter;
	resolution: "all" | ResolutionBucketName;
	durationBucket: "all" | DurationBucketName;
	codec: string;
}): boolean {
	return (
		filters.search.trim() !== "" ||
		filters.watched !== "all" ||
		filters.resolution !== "all" ||
		filters.durationBucket !== "all" ||
		filters.codec.trim() !== ""
	);
}

export function toDuplicateIdSet(groups: DuplicateGroupDto[]): Set<string> {
	return new Set(groups.flatMap((group) => group.memberIds));
}
