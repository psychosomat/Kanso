import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";

import { cn } from "@/lib/utils";

function Slider({
	className,
	defaultValue,
	value,
	min = 0,
	max = 100,
	...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
	const _values = React.useMemo(
		() =>
			Array.isArray(value)
				? value
				: Array.isArray(defaultValue)
					? defaultValue
					: [min, max],
		[value, defaultValue, min, max],
	);

	return (
		<SliderPrimitive.Root
			data-slot="slider"
			defaultValue={defaultValue}
			value={value}
			min={min}
			max={max}
			className={cn(
				"relative flex w-full touch-none items-center select-none data-disabled:opacity-50",
				className,
			)}
			{...props}
		>
			<SliderPrimitive.Track
				data-slot="slider-track"
				className={cn(
					"relative h-1.5 w-full grow overflow-hidden rounded-full bg-white/12",
				)}
			>
				<SliderPrimitive.Range
					data-slot="slider-range"
					className={cn("bg-(--accent) absolute h-full rounded-full")}
				/>
			</SliderPrimitive.Track>
			{_values.map((_, index) => (
				<SliderPrimitive.Thumb
					data-slot="slider-thumb"
					// biome-ignore lint/suspicious/noArrayIndexKey: thumbs are positional; keying by value remounts the thumb mid-drag and breaks pointer capture
					key={`slider-thumb-${index}`}
					className={cn(
						"block h-3.5 w-3.5 rounded-full border-2 border-(--accent) bg-(--accent) shadow-[0_0_14px_-2px_var(--accent)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) disabled:pointer-events-none disabled:opacity-50",
					)}
				/>
			))}
		</SliderPrimitive.Root>
	);
}

export { Slider };
