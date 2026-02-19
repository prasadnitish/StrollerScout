export function getPackingItemIds(packingList) {
  if (!packingList?.categories) return new Set();

  const ids = new Set();
  packingList.categories.forEach((category, catIndex) => {
    const categoryId = `${category.name}-${catIndex}`;
    category.items.forEach((_, itemIndex) => {
      ids.add(`${categoryId}-${itemIndex}`);
    });
  });
  return ids;
}

export function filterCheckedItems(checkedItemIds, validItemIds) {
  return checkedItemIds.filter((itemId) => validItemIds.has(itemId));
}
