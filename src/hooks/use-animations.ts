import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useCallback, useRef } from "react";

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

export function useStaggerAnimation<T extends HTMLElement>(
	itemsSelector: string,
	opts?: {
		delay?: number;
		stagger?: number;
		y?: number;
	},
) {
	const containerRef = useRef<T>(null);
	const { delay = 0, stagger = 0.05, y = 16 } = opts ?? {};

	useGSAP(
		() => {
			if (!containerRef.current) return;

			const items = containerRef.current.querySelectorAll(itemsSelector);
			if (items.length === 0) return;

			const ctx = gsap.context(() => {
				gsap.fromTo(
					items,
					{ opacity: 0, y },
					{
						opacity: 1,
						y: 0,
						duration: duration.normal,
						ease: easing.smooth,
						stagger: {
							each: stagger,
							from: "start",
						},
						delay,
					},
				);
			});

			return () => ctx.revert();
		},
		{ scope: containerRef },
	);

	return containerRef;
}

export function useMicroInteraction<T extends HTMLElement>() {
	const elementRef = useRef<T>(null);
	const tweenRef = useRef<gsap.core.Tween | null>(null);

	const onPointerEnter = useCallback(() => {
		if (!elementRef.current) return;
		if (tweenRef.current) tweenRef.current.kill();

		tweenRef.current = gsap.to(elementRef.current, {
			scale: 1.02,
			duration: duration.fast,
			ease: easing.smooth,
		});
	}, []);

	const onPointerLeave = useCallback(() => {
		if (!elementRef.current) return;
		if (tweenRef.current) tweenRef.current.kill();

		tweenRef.current = gsap.to(elementRef.current, {
			scale: 1,
			duration: duration.fast,
			ease: easing.smooth,
		});
	}, []);

	const onPointerDown = useCallback(() => {
		if (!elementRef.current) return;
		if (tweenRef.current) tweenRef.current.kill();

		tweenRef.current = gsap.to(elementRef.current, {
			scale: 0.98,
			duration: duration.fast / 2,
			ease: easing.snap,
		});
	}, []);

	const onPointerUp = useCallback(() => {
		if (!elementRef.current) return;
		if (tweenRef.current) tweenRef.current.kill();

		tweenRef.current = gsap.to(elementRef.current, {
			scale: 1,
			duration: duration.fast,
			ease: easing.bounce,
		});
	}, []);

	return {
		ref: elementRef,
		handlers: {
			onPointerEnter,
			onPointerLeave,
			onPointerDown,
			onPointerUp,
		},
	};
}

export function useDialogAnimation(isOpen: boolean) {
	const overlayRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);

	useGSAP(
		() => {
			const overlay = overlayRef.current;
			const content = contentRef.current;

			if (!overlay || !content) return;

			const ctx = gsap.context(() => {
				if (isOpen) {
					gsap.fromTo(
						overlay,
						{ opacity: 0 },
						{ opacity: 1, duration: duration.normal, ease: easing.smooth },
					);
					gsap.fromTo(
						content,
						{ opacity: 0, scale: 0.95, y: 20 },
						{
							opacity: 1,
							scale: 1,
							y: 0,
							duration: duration.normal,
							ease: easing.bounce,
							delay: 0.05,
						},
					);
				} else {
					gsap.to(overlay, {
						opacity: 0,
						duration: duration.fast,
						ease: easing.smooth,
					});
					gsap.to(content, {
						opacity: 0,
						scale: 0.98,
						y: 10,
						duration: duration.fast,
						ease: easing.smooth,
					});
				}
			});

			return () => ctx.revert();
		},
		{ dependencies: [isOpen] },
	);

	return { overlayRef, contentRef };
}

export function useCountUp(
	endValue: number,
	duration: number = 1,
	startValue: number = 0,
) {
	const elementRef = useRef<HTMLSpanElement>(null);
	const tweenRef = useRef<gsap.core.Tween | null>(null);

	useGSAP(
		() => {
			if (!elementRef.current) return;

			const obj = { value: startValue };

			if (tweenRef.current) tweenRef.current.kill();

			tweenRef.current = gsap.to(obj, {
				value: endValue,
				duration,
				ease: "power2.out",
				onUpdate: () => {
					if (elementRef.current) {
						elementRef.current.textContent = Math.round(obj.value).toString();
					}
				},
			});
		},
		{ dependencies: [endValue] },
	);

	return elementRef;
}

const prefersReducedMotion =
	typeof window !== "undefined" &&
	window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const shouldAnimate = !prefersReducedMotion;
