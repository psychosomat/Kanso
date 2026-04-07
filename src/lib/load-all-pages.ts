type PaginatedResult<TItem> = {
	items: TItem[];
	total: number;
	page: number;
	pageSize: number;
};

const MAX_PAGE_SIZE = 100;

export async function loadAllPages<TItem, TPage extends PaginatedResult<TItem>>(
	loadPage: (page: number, pageSize: number) => Promise<TPage>,
): Promise<TPage> {
	const firstPage = await loadPage(1, MAX_PAGE_SIZE);
	if (firstPage.total <= firstPage.items.length) {
		return firstPage;
	}

	const totalPages = Math.ceil(firstPage.total / firstPage.pageSize);
	const remainingPages = await Promise.all(
		Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) =>
			loadPage(index + 2, firstPage.pageSize),
		),
	);

	return {
		...firstPage,
		items: [
			firstPage.items,
			...remainingPages.map((page) => page.items),
		].flat(),
		page: 1,
		pageSize: firstPage.total,
	};
}
