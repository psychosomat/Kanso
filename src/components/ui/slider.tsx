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
					"bg-(--accent)/20 relative grow overflow-hidden rounded-full h-1.5 w-full",
				)}
			>
				<SliderPrimitive.Range
					data-slot="slider-range"
					className={cn("bg-(--accent) absolute h-full rounded-full")}
				/>
			</SliderPrimitive.Track>
			{_values.map((val) => (
				<SliderPrimitive.Thumb
					data-slot="slider-thumb"
					key={`slider-thumb-${val}`}
					className={cn(
						"border-(--accent) bg-(--accent) ring-(--accent)/50 block h-4 w-4 rounded-full border-2 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
					)}
				/>
			))}
		</SliderPrimitive.Root>
	);
}

export { Slider };
