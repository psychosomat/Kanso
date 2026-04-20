import { StrictMode } from "react";
import { getRouter } from "./router";
import { RouterProvider } from "@tanstack/react-router";
import { createRoot } from "react-dom/client";

const router = getRouter();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

const root = createRoot(rootElement);
root.render(
	<StrictMode>
		<RouterProvider router={router} />
	</StrictMode>,
);
