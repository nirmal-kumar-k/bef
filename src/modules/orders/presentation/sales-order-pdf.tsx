import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { Order } from '@/modules/orders/domain/order.types'

// Shared professional print template: clean margins, thin borders, no logo/
// letterhead clutter - just the document content and a single footer line
// (Babu's Engineering Foundry). Kept in one place so future printable
// documents (planning schedules, etc.) can match this exact look.
const styles = StyleSheet.create({
  page: {
    padding: '36pt 40pt 56pt 40pt',
    fontSize: 9.5,
    fontFamily: 'Helvetica',
    color: '#172554',
  },
  title: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 9,
    color: '#64748B',
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: '1pt solid #E0E7FF',
    borderBottom: '1pt solid #E0E7FF',
    paddingVertical: 10,
    marginBottom: 16,
  },
  infoCell: {
    flexDirection: 'column',
  },
  infoLabel: {
    fontSize: 7.5,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  table: {
    border: '1pt solid #CBD5E1',
    marginBottom: 16,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F4F6FB',
    borderBottom: '1pt solid #CBD5E1',
    paddingVertical: 6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '0.5pt solid #E0E7FF',
    paddingVertical: 6,
  },
  th: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    color: '#64748B',
    letterSpacing: 0.4,
  },
  td: {
    fontSize: 9,
  },
  colProduct: { width: '32%', paddingHorizontal: 8 },
  colQty: { width: '14%', paddingHorizontal: 8, textAlign: 'right' },
  colWeight: { width: '14%', paddingHorizontal: 8, textAlign: 'right' },
  colCost: { width: '18%', paddingHorizontal: 8, textAlign: 'right' },
  colTotal: { width: '22%', paddingHorizontal: 8, textAlign: 'right' },
  totalsBlock: {
    alignSelf: 'flex-end',
    width: 220,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  totalsLabel: {
    fontSize: 9,
    color: '#64748B',
  },
  totalsValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: '1pt solid #CBD5E1',
    marginTop: 4,
    paddingTop: 6,
  },
  grandTotalLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  grandTotalValue: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#94A3B8',
    borderTop: '0.5pt solid #E0E7FF',
    paddingTop: 8,
  },
})

const money = (n: number) => `Rs. ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function SalesOrderPdf({ order }: { order: Order }) {
  const totalQty = (order.cart || []).reduce((acc, item) => acc + (item.quantity || 0), 0)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Sales Order {order.customerOrderNo}</Text>
        <Text style={styles.subtitle}>Internal Ref: {order.internalOrderNo || '-'}  |  Status: {order.status}</Text>

        <View style={styles.infoRow}>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Customer</Text>
            <Text style={styles.infoValue}>{order.customer}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Order Date</Text>
            <Text style={styles.infoValue}>{order.orderDate || '-'}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Delivery Date</Text>
            <Text style={styles.infoValue}>{order.deliveryDate || '-'}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Total Quantity</Text>
            <Text style={styles.infoValue}>{totalQty.toLocaleString()}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colProduct]}>Product</Text>
            <Text style={[styles.th, styles.colQty]}>Ordered Qty</Text>
            <Text style={[styles.th, styles.colQty]}>Delivered</Text>
            <Text style={[styles.th, styles.colWeight]}>Weight</Text>
            <Text style={[styles.th, styles.colCost]}>Unit Cost</Text>
            <Text style={[styles.th, styles.colTotal]}>Line Total</Text>
          </View>
          {(order.cart || []).map((item, idx) => {
            const safeUnitCost = item.unitCost ?? (item.weight * item.ratePerKg) ?? 0
            const lineTotal = safeUnitCost * item.quantity
            return (
              <View key={item.id || idx} style={styles.tableRow}>
                <Text style={[styles.td, styles.colProduct]}>{item.productName}</Text>
                <Text style={[styles.td, styles.colQty]}>{item.quantity.toLocaleString()}</Text>
                <Text style={[styles.td, styles.colQty]}>{item.deliveryQuantity || 0}</Text>
                <Text style={[styles.td, styles.colWeight]}>{item.weight} kg</Text>
                <Text style={[styles.td, styles.colCost]}>{money(safeUnitCost)}</Text>
                <Text style={[styles.td, styles.colTotal]}>{money(lineTotal)}</Text>
              </View>
            )
          })}
        </View>

        {order.subtotal > 0 && (
          <View style={styles.totalsBlock}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>{money(order.subtotal)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>GST ({order.gstPercent}%)</Text>
              <Text style={styles.totalsValue}>{money(order.gstAmount)}</Text>
            </View>
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>{money(order.grandTotal)}</Text>
            </View>
          </View>
        )}

        <Text style={styles.footer} fixed>Babu&apos;s Engineering Foundry</Text>
      </Page>
    </Document>
  )
}
