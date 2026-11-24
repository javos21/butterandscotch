import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatFulfilDate } from "@/lib/format-date";
import { formatMoney } from "@/lib/money";
import type { ReceiptData } from "@/lib/receipt/receipt-data";

const RED = "#8B1E1E";
const INK = "#18181B";
const MUTED = "#71717A";
const RULE = "#E4E4E7";

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: "Helvetica", fontSize: 10, color: INK },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  logo: { width: 120 },
  title: { fontSize: 18, color: RED, fontFamily: "Helvetica-Bold" },
  orderNumber: { marginTop: 4, fontSize: 11, color: MUTED },
  details: { marginBottom: 18 },
  detailRow: { flexDirection: "row", marginBottom: 3 },
  detailLabel: { width: 90, color: MUTED },
  detailValue: { flex: 1 },
  table: { borderTopWidth: 1, borderTopColor: RULE, marginBottom: 12 },
  row: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: RULE },
  headRow: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: RULE, color: MUTED },
  colItem: { flex: 4 },
  colQty: { flex: 1, textAlign: "right" },
  colPrice: { flex: 2, textAlign: "right" },
  colTotal: { flex: 2, textAlign: "right" },
  totals: { alignItems: "flex-end", marginTop: 6 },
  totalLine: { flexDirection: "row", marginBottom: 3, width: 220 },
  totalLabel: { flex: 1, color: MUTED },
  totalValue: { width: 90, textAlign: "right" },
  grand: { flexDirection: "row", marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: INK, width: 220 },
  grandLabel: { flex: 1, fontFamily: "Helvetica-Bold" },
  grandValue: { width: 90, textAlign: "right", fontFamily: "Helvetica-Bold" },
  paid: { marginTop: 8, textAlign: "right", color: RED, fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 28, left: 36, right: 36, color: MUTED, fontSize: 9, textAlign: "center" },
});

/** The customer receipt: logo, order details, items, totals and a WhatsApp contact line. */
export function ReceiptDocument({ data, logo }: { data: ReceiptData; logo: Buffer | null }) {
  const isDelivery = data.fulfilment === "delivery";
  return (
    <Document title={`Receipt ${data.orderNumber}`} author="Butter & Scotch">
      <Page size="A5" style={styles.page}>
        <View style={styles.header}>
          {logo ? (
            /* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf images take no alt text */
            <Image src={logo} style={styles.logo} />
          ) : (
            <View />
          )}
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.title}>Receipt</Text>
            <Text style={styles.orderNumber}>Order {data.orderNumber}</Text>
          </View>
        </View>

        <View style={styles.details}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Customer</Text>
            <Text style={styles.detailValue}>{data.customerName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date paid</Text>
            <Text style={styles.detailValue}>{formatFulfilDate(data.paidOn)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{isDelivery ? "Delivery" : "Pickup"}</Text>
            <Text style={styles.detailValue}>
              {formatFulfilDate(data.fulfilDate)}
              {isDelivery && data.areaName ? ` · ${data.areaName}` : ""}
            </Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.headRow}>
            <Text style={styles.colItem}>Item</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colPrice}>Price</Text>
            <Text style={styles.colTotal}>Total</Text>
          </View>
          {data.lines.map((line, index) => (
            <View key={`${line.name}-${index}`} style={styles.row} wrap={false}>
              <View style={styles.colItem}>
                <Text>{line.name}</Text>
                {line.flavour && <Text style={{ color: MUTED }}>{line.flavour}</Text>}
              </View>
              <Text style={styles.colQty}>{line.quantity}</Text>
              <Text style={styles.colPrice}>{formatMoney(line.unitPriceCents)}</Text>
              <Text style={styles.colTotal}>{formatMoney(line.lineTotalCents)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          {isDelivery && data.deliveryFeeCents !== null && (
            <View style={styles.totalLine}>
              <Text style={styles.totalLabel}>Delivery fee</Text>
              <Text style={styles.totalValue}>{formatMoney(data.deliveryFeeCents)}</Text>
            </View>
          )}
          {data.adjustmentsCents !== 0 && (
            <View style={styles.totalLine}>
              <Text style={styles.totalLabel}>Adjustments</Text>
              <Text style={styles.totalValue}>{formatMoney(data.adjustmentsCents)}</Text>
            </View>
          )}
          <View style={styles.grand}>
            <Text style={styles.grandLabel}>Total</Text>
            <Text style={styles.grandValue}>{formatMoney(data.totalCents)}</Text>
          </View>
          <Text style={styles.paid}>Paid in full — bank transfer</Text>
        </View>

        {data.whatsappNumber && (
          <Text style={styles.footer}>Questions? WhatsApp {data.whatsappNumber}</Text>
        )}
      </Page>
    </Document>
  );
}
