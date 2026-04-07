import type { CategoryDto } from "./contracts";

export type CategoryTreeNode = CategoryDto & {
	children: CategoryTreeNode[];
	depth: number;
};

export function buildCategoryTree(categories: CategoryDto[]) {
	const byId = new Map<string, CategoryTreeNode>();
	for (const category of categories) {
		byId.set(category.id, {
			...category,
			children: [],
			depth: 0,
		});
	}

	const roots: CategoryTreeNode[] = [];
	for (const node of byId.values()) {
		const parent = node.parentCategoryId
			? byId.get(node.parentCategoryId)
			: null;
		if (!parent || parent.id === node.id) {
			roots.push(node);
			continue;
		}
		node.depth = parent.depth + 1;
		parent.children.push(node);
	}

	const sortNodes = (nodes: CategoryTreeNode[], depth: number) => {
		nodes.sort((left, right) => left.name.localeCompare(right.name));
		for (const node of nodes) {
			node.depth = depth;
			sortNodes(node.children, depth + 1);
		}
	};

	sortNodes(roots, 0);
	return roots;
}

export function flattenCategoryTree(nodes: CategoryTreeNode[]) {
	const items: CategoryTreeNode[] = [];

	const visit = (node: CategoryTreeNode) => {
		items.push(node);
		for (const child of node.children) {
			visit(child);
		}
	};

	for (const node of nodes) {
		visit(node);
	}

	return items;
}

export function getCategoryDescendantIds(
	categoryId: string,
	categories: CategoryDto[],
) {
	const childrenByParent = new Map<string, string[]>();
	for (const category of categories) {
		if (!category.parentCategoryId) continue;
		const children = childrenByParent.get(category.parentCategoryId) ?? [];
		children.push(category.id);
		childrenByParent.set(category.parentCategoryId, children);
	}

	const descendants = new Set<string>();
	const stack = [...(childrenByParent.get(categoryId) ?? [])];
	while (stack.length > 0) {
		const next = stack.pop();
		if (!next || descendants.has(next)) continue;
		descendants.add(next);
		for (const child of childrenByParent.get(next) ?? []) {
			stack.push(child);
		}
	}

	return descendants;
}
