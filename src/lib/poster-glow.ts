export function averagePosterColor(url: string): Promise<string | null> {
	return new Promise((resolve) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => {
			try {
				const canvas = document.createElement("canvas");
				canvas.width = 16;
				canvas.height = 16;
				const ctx = canvas.getContext("2d", { willReadFrequently: true });
				if (!ctx) {
					resolve(null);
					return;
				}
				ctx.drawImage(img, 0, 0, 16, 16);
				const pixels = ctx.getImageData(0, 0, 16, 16).data;
				let r = 0;
				let g = 0;
				let b = 0;
				let n = 0;
				for (let i = 0; i < pixels.length; i += 16) {
					r += pixels[i] ?? 0;
					g += pixels[i + 1] ?? 0;
					b += pixels[i + 2] ?? 0;
					n += 1;
				}
				if (n === 0) {
					resolve(null);
					return;
				}
				resolve(
					`rgba(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)}, 0.5)`,
				);
			} catch {
				resolve(null);
			}
		};
		img.onerror = () => resolve(null);
		img.src = url;
	});
}
