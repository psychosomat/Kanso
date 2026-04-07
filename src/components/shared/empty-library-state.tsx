import { IconFolderOpen, IconPlayerSkipBackFilled } from "@tabler/icons-react";
import { APP_NAME } from "@/lib/constants";
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
			<div className="max-w-md text-center">
				<div className="relative mx-auto flex h-20 w-20 items-center justify-center">
					<div className="absolute inset-0 rounded-2xl bg-linear-to-br from-(--accent) to-(--accent-hover) opacity-20 blur-xl" />
					<div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-linear-to-br from-(--accent) to-(--accent-hover) text-white shadow-lg">
						<IconPlayerSkipBackFilled size={40} />
					</div>
				</div>

				<h2 className="mt-6 text-2xl font-semibold tracking-tight text-(--foreground)">
					Welcome to {APP_NAME}
				</h2>
				<p className="mt-2 text-(--muted-foreground)">
					Choose a folder to start indexing your video library
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

				<p className="mt-4 text-xs text-(--muted-foreground)/60">
					Your files stay in place. We only index them.
				</p>
			</div>
		</div>
	);
}
