import type { GoodsReceiptNote, PurchaseOrder, Supplier } from "../domain/types";

export interface ERPAdapter {
  findSupplier(id: string): Promise<Supplier | null>;
  findPurchaseOrder(poNumber: string): Promise<PurchaseOrder | null>;
  findGoodsReceipt(poId: string): Promise<GoodsReceiptNote | null>;
}
export class MockERPAdapter implements ERPAdapter {
  constructor(private data: { suppliers: Supplier[]; purchaseOrders: PurchaseOrder[]; goodsReceipts: GoodsReceiptNote[] }) {}
  async findSupplier(id: string) { return this.data.suppliers.find(x => x.id === id) ?? null }
  async findPurchaseOrder(poNumber: string) { return this.data.purchaseOrders.find(x => x.poNumber === poNumber) ?? null }
  async findGoodsReceipt(poId: string) { return this.data.goodsReceipts.find(x => x.poId === poId) ?? null }
}
