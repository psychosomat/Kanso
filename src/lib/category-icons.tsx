import IconBolt from "~icons/tabler/bolt";
import IconBookmark from "~icons/tabler/bookmark";
import IconBrain from "~icons/tabler/brain";
import IconCloud from "~icons/tabler/cloud";
import IconCrown from "~icons/tabler/crown";
import IconDeviceTv from "~icons/tabler/device-tv";
import IconDiamond from "~icons/tabler/diamond";
import IconDroplet from "~icons/tabler/droplet";
import IconFlame from "~icons/tabler/flame";
import IconFolder from "~icons/tabler/folder";
import IconFolders from "~icons/tabler/folders";
import IconGhost2 from "~icons/tabler/ghost-2";
import IconHeart from "~icons/tabler/heart";
import IconLeaf from "~icons/tabler/leaf";
import IconMoon from "~icons/tabler/moon";
import IconMusic from "~icons/tabler/music";
import IconPaw from "~icons/tabler/paw";
import IconPhoto from "~icons/tabler/photo";
import IconPlayerPlayFilled from "~icons/tabler/player-play-filled";
import IconRocket from "~icons/tabler/rocket";
import IconSkull from "~icons/tabler/skull";
import IconSparkles from "~icons/tabler/sparkles";
import IconStar from "~icons/tabler/star";
import IconSun from "~icons/tabler/sun";
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
