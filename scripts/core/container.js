export class PlayerInventory {
  constructor(player) {
    this.player = player;
    this.container = player.getComponent("minecraft:inventory").container;
  }

  getContainerItems() {
    const items = [];

    for (let i = 0; i < this.container.size; i++) {
      const item = this.container.getItem(i);
      if (item) items.push([item, i]);
    }

    return items;
  }

  hasItem(typeId) {
    for (let i = 0; i < this.container.size; i++) {
      const item = this.container.getItem(i);
      if (item?.typeId === typeId) return true;
    }
    return false;
  }

  removeItem(typeId, amount = 1) {
    for (let i = 0; i < this.container.size; i++) {
      const item = this.container.getItem(i);

      if (item?.typeId === typeId) {
        item.amount -= amount;

        if (item.amount <= 0) {
          this.container.setItem(i, undefined);
        } else {
          this.container.setItem(i, item);
        }

        return true;
      }
    }

    return false;
  }
}