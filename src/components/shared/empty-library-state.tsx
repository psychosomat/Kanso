import { APP_NAME } from "@/lib/constants";
import IconFolderOpen from "~icons/tabler/folder-open";
import IconPlayerPlayFilled from "~icons/tabler/player-play-filled";
import { Button } from "../ui/button";

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
		<div className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-6">
			<div className="max-w-sm text-center">
				<div className="relative mx-auto flex h-16 w-16 items-center justify-center">
					<div className="absolute inset-0 rounded-2xl bg-(--accent) opacity-30 blur-2xl" />
					<div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-(--accent) text-white shadow-[0_8px_32px_-6px_var(--accent)]">
						<IconPlayerPlayFilled size={26} />
					</div>
				</div>

				<h2 className="font-display mt-6 text-[22px] font-semibold text-(--foreground)">
					Welcome to {APP_NAME}
				</h2>
				<p className="mt-2 text-sm leading-relaxed text-(--muted-foreground)">
					Choose a folder to start indexing your video library. Your files stay
					exactly where they are.
				</p>

				{!electronReady && (
					<div className="mt-4 rounded-lg bg-(--destructive-subtle) px-4 py-3 text-sm text-(--destructive)">
						Electron bridge is not available. Waiting to load...
					</div>
				)}

				<Button
					className="mt-6"
					size="lg"
					onClick={onChooseFolder}
					disabled={pending}
				>
					<IconFolderOpen size={16} />
					{pending ? "Opening..." : "Choose folder"}
				</Button>
			</div>
		</div>
	);
}
