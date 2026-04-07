import {
	IconBolt,
	IconBookmark,
	IconBrain,
	IconCloud,
	IconCrown,
	IconDeviceTv,
	IconDiamond,
	IconDroplet,
	IconFlame,
	IconFolder,
	IconFolders,
	IconGhost2,
	IconHeart,
	IconLeaf,
	IconMoon,
	IconMusic,
	IconPaw,
	IconPhoto,
	IconPlayerPlayFilled,
	IconRocket,
	IconSkull,
	IconSparkles,
	IconStar,
	IconSun,
} from "@tabler/icons-react";
import type { CategoryIconName } from "./contracts";

type CategoryIconDefinition = {
	name: CategoryIconName;
	label: string;
	Icon: React.ComponentType<{ size?: number; className?: string }>;
};

export const CATEGORY_ICONS: CategoryIconDefinition[] = [
	{ name: "folder", label: "Folder", Icon: IconFolder },
	{ name: "folders", label: "Folders", Icon: IconFolders },
	{ name: "star", label: "Star", Icon: IconStar },
	{ name: "heart", label: "Heart", Icon: IconHeart },
	{ name: "flame", label: "Flame", Icon: IconFlame },
	{ name: "bolt", label: "Bolt", Icon: IconBolt },
	{ name: "sparkles", label: "Sparkles", Icon: IconSparkles },
	{ name: "bookmark", label: "Bookmark", Icon: IconBookmark },
	{ name: "music", label: "Music", Icon: IconMusic },
	{ name: "photo", label: "Photo", Icon: IconPhoto },
	{ name: "video", label: "Video", Icon: IconPlayerPlayFilled },
	{ name: "deviceTv", label: "Screen", Icon: IconDeviceTv },
	{ name: "rocket", label: "Rocket", Icon: IconRocket },
	{ name: "brain", label: "Brain", Icon: IconBrain },
	{ name: "ghost", label: "Ghost", Icon: IconGhost2 },
	{ name: "skull", label: "Skull", Icon: IconSkull },
	{ name: "sun", label: "Sun", Icon: IconSun },
	{ name: "moon", label: "Moon", Icon: IconMoon },
	{ name: "cloud", label: "Cloud", Icon: IconCloud },
	{ name: "droplet", label: "Droplet", Icon: IconDroplet },
	{ name: "leaf", label: "Leaf", Icon: IconLeaf },
	{ name: "paw", label: "Paw", Icon: IconPaw },
	{ name: "diamond", label: "Diamond", Icon: IconDiamond },
	{ name: "crown", label: "Crown", Icon: IconCrown },
];

const categoryIconsByName = new Map(
	CATEGORY_ICONS.map((definition) => [definition.name, definition]),
);

export function getCategoryIconDefinition(name: CategoryIconName) {
	const fallback = categoryIconsByName.get("folder");
	if (!fallback) {
		throw new Error("Default category icon is missing.");
	}

	return categoryIconsByName.get(name) ?? fallback;
}

export function CategoryIcon({
	name,
	size = 16,
	className,
}: {
	name: CategoryIconName;
	size?: number;
	className?: string;
}) {
	const { Icon } = getCategoryIconDefinition(name);
	return <Icon size={size} className={className} />;
}
