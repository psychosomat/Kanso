import { APP_NAME } from "@/lib/constants";
import IconFolderOpen from "~icons/tabler/folder-open";
import { Button } from "../ui/button";

export function getEmptyLibraryCtaLabel(pending?: boolean): string {
	return pending ? "Opening..." : "Choose folder";
}

export function shouldShowElectronWarning(electronReady?: boolean): boolean {
	return !electronReady;
}

export function EmptyLibraryState({
	onChooseFolder,
	pending,
	electronReady,
}: {
	onChooseFolder: () => void;
	pending?: boolean;
	electronReady?: boolean;
}) {
	return (
		<div className="flex min-h-screen items-center justify-center px-6">
			<div className="relative max-w-md text-center">
				<div
					aria-hidden="true"
					className="pointer-events-none absolute left-1/2 top-0 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--accent) opacity-20 blur-3xl"
				/>

				<p className="eyebrow relative text-(--muted-foreground)/70">
					Local-first video library
				</p>
				<h2 className="font-display relative mt-3 text-[34px] font-semibold leading-none text-(--foreground)">
					Welcome to {APP_NAME}
				</h2>
				<p className="relative mx-auto mt-4 max-w-sm text-[13px] leading-relaxed text-(--muted-foreground)">
					Choose a folder to start indexing your videos. Files stay exactly
					where they are — nothing is copied or moved.
				</p>

				{shouldShowElectronWarning(electronReady) && (
					<div className="relative mt-6 rounded-(--radius) border border-(--destructive)/25 bg-(--destructive-subtle) px-4 py-3 text-sm text-(--destructive)">
						Electron bridge is not available. Waiting to load...
					</div>
				)}

				<Button
					className="relative mt-8"
					size="lg"
					onClick={onChooseFolder}
					disabled={pending}
				>
					<IconFolderOpen size={16} />
					{getEmptyLibraryCtaLabel(pending)}
				</Button>
			</div>
		</div>
	);
}
