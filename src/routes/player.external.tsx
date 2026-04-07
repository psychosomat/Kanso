import { createFileRoute } from "@tanstack/react-router";
import { PlayerPage } from "./player.$videoId";

export const Route = createFileRoute("/player/external")({
	validateSearch: (search: Record<string, unknown>) => ({
		path: typeof search.path === "string" ? search.path : "",
	}),
	component: ExternalPlayerRoute,
});

function ExternalPlayerRoute() {
	const { path } = Route.useSearch();
	return <PlayerPage mode="external" sourcePath={path} />;
}
