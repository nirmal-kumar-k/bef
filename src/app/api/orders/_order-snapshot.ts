// What the change history stores for an order: the order row plus its cart.
// Cart lines are compared without their row id/orderId - every edit deletes
// and re-inserts them, so the ids change even when nothing else did, and
// would otherwise make every save look like a cart change.
export function orderSnapshot(order: Record<string, unknown>, cart: Record<string, unknown>[]) {
  return {
    ...order,
    cart: cart.map(({ id: _id, orderId: _orderId, ...line }) => line),
  }
}
