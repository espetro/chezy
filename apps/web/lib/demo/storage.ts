export const clearDemoAutoCallMarkers = (
  storage: Pick<Storage, "length" | "key" | "removeItem">,
) => {
  for (let index = storage.length - 1; index >= 0; index--) {
    const key = storage.key(index);
    if (key?.startsWith("chezy:autocall:")) storage.removeItem(key);
  }
};
