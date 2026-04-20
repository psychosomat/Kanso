import React from "react";
import type { ReactNode } from "react";

type Props = {
	children: ReactNode;
	fallback?: ReactNode;
};

type State = {
	hasError: boolean;
	error?: Error;
};

export class ErrorBoundary extends React.Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		console.error("ErrorBoundary caught an error:", error, errorInfo);
	}

	override render() {
		if (this.state.hasError) {
			if (this.props.fallback) {
				return this.props.fallback;
			}
			return (
				<div className="flex h-full items-center justify-center">
					<div className="text-center">
						<h2 className="text-lg font-semibold">Something went wrong</h2>
						<p className="text-(--muted-foreground)">
							{this.state.error?.message || "An unexpected error occurred"}
						</p>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}
