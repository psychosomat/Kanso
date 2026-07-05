import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";

gsap.registerPlugin(useGSAP);

export const easing = {
	smooth: "power2.out",
	bounce: "back.out(1.7)",
	snap: "power4.out",
	elastic: "elastic.out(1, 0.5)",
} as const;

export const duration = {
	fast: 0.15,
	normal: 0.3,
	slow: 0.5,
	hero: 0.8,
} as const;

export function usePageTransition() {
	const containerRef = useRef<HTMLDivElement>(null);

	useGSAP(
		() => {
			const ctx = gsap.context(() => {
				gsap.fromTo(
					containerRef.current,
					{ opacity: 0, y: 12, scale: 0.98 },
					{
						opacity: 1,
						y: 0,
						scale: 1,
						duration: duration.normal,
						ease: easing.smooth,
					},
				);
			});

			return () => ctx.revert();
		},
		{ scope: containerRef },
	);

	return containerRef;
}
