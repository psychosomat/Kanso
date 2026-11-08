// @vitest-environment jsdom
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CategoryDto } from "@/lib/contracts";
import { DeleteCategoryDialog } from "./delete-category-dialog";

const mocks = vi.hoisted(() => ({
	remove: vi.fn(),
	refreshAll: vi.fn(),
	navigate: vi.fn(),
	useLocation: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	useRouter: () => ({ navigate: mocks.navigate }),
	useLocation: () => mocks.useLocation(),
}));
vi.mock("@/components/layout/app-state", () => ({
	useAppState: () => ({ refreshAll: mocks.refreshAll }),
}));
vi.mock("@/lib/player-api", () => ({
	getPlayerApi: () => ({ categories: { remove: mocks.remove } }),
}));

const category: CategoryDto = {
	id: "cat-1",
	slug: "parent",
	name: "Parent",
	description: null,
	parentCategoryId: null,
	icon: "folder",
	postCount: 2,
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
};

beforeEach(() => {
	mocks.remove.mockReset().mockResolvedValue(undefined);
	mocks.refreshAll.mockReset().mockResolvedValue(undefined);
	mocks.navigate.mockReset().mockResolvedValue(undefined);
	mocks.useLocation.mockReset().mockReturnValue({ pathname: "/dump" });
});

afterEach(() => {
	cleanup();
});

function renderDialog(onOpenChange = vi.fn()) {
	render(
		<DeleteCategoryDialog
			open
			onOpenChange={onOpenChange}
			category={category}
		/>,
	);
	return onOpenChange;
}

describe("DeleteCategoryDialog", () => {
	it("removes the category, refreshes state and closes", async () => {
		const onOpenChange = renderDialog();

		expect(screen.getByText('Delete "Parent"?')).toBeTruthy();
		expect(screen.getByText(/Videos stay in your library/)).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Delete board" }));

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		expect(mocks.remove).toHaveBeenCalledWith("cat-1");
		expect(mocks.refreshAll).toHaveBeenCalledOnce();
		expect(mocks.navigate).not.toHaveBeenCalled();
	});

	it("navigates away from the deleted board's own page", async () => {
		mocks.useLocation.mockReturnValue({ pathname: "/categories/parent" });
		const onOpenChange = renderDialog();

		fireEvent.click(screen.getByRole("button", { name: "Delete board" }));

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		expect(mocks.navigate).toHaveBeenCalledWith({ to: "/dump" });
	});

	it("keeps the dialog open and reports a failed removal", async () => {
		mocks.remove.mockRejectedValue(new Error("database is locked"));
		const onOpenChange = renderDialog();

		fireEvent.click(screen.getByRole("button", { name: "Delete board" }));

		expect(await screen.findByRole("alert")).toHaveProperty(
			"textContent",
			"database is locked",
		);
		expect(onOpenChange).not.toHaveBeenCalled();
		expect(mocks.refreshAll).not.toHaveBeenCalled();
		expect(mocks.navigate).not.toHaveBeenCalled();
	});

	it("does not close while a removal is in flight", async () => {
		let resolveRemoval: (() => void) | undefined;
		mocks.remove.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					resolveRemoval = resolve;
				}),
		);
		const onOpenChange = renderDialog();

		fireEvent.click(screen.getByRole("button", { name: "Delete board" }));
		expect(screen.getByRole("button", { name: "Deleting…" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Cancel" })).toHaveProperty(
			"disabled",
			true,
		);

		resolveRemoval?.();
		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
	});
});
