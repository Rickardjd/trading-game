// items.json lists each hire tool once with a quantity; each physical unit needs its
// own barcode so it can be checked out and back in individually, e.g. H-SCISSORS
// with quantity 3 becomes H-SCISSORS-1 "Scissors #1" ... H-SCISSORS-3 "Scissors #3".
module.exports = function expandItems(items) {
  return items.flatMap((item) => {
    if (item.type !== 'hire') return [item];
    const quantity = item.quantity ?? 1;
    return Array.from({ length: quantity }, (_, i) => ({
      ...item,
      code: `${item.code}-${i + 1}`,
      name: `${item.name} #${i + 1}`,
    }));
  });
};
