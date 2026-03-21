import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font, Image } from '@react-pdf/renderer';
import { Invoice, ClientCustomer, User } from '@/lib/types';
import { format } from 'date-fns';

// Keep font registration simple. If this ever causes deployment/runtime issues,
// remove it entirely and rely on the built-in Helvetica.
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/helvetica/v11/KFOmCnqEu92Fr1Me5g.ttf' },
    { src: 'https://fonts.gstatic.com/s/helvetica/v11/KFOnCnqEu92Fr1Me5gBF.ttf', fontWeight: 'bold' },
    { src: 'https://fonts.gstatic.com/s/helvetica/v11/KFOjCnqEu92Fr1Ma5gBFM.ttf', fontStyle: 'italic' },
    { src: 'https://fonts.gstatic.com/s/helvetica/v11/KFOiCnqEu92Fr1Ma5gBFM_A.ttf', fontStyle: 'italic', fontWeight: 'bold' },
  ],
});

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    padding: 40,
    backgroundColor: '#fff',
    color: '#333',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  companyDetails: {
    width: '50%',
  },
  invoiceDetails: {
    width: '40%',
    textAlign: 'right',
  },
  companyName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  invoiceTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ccc',
    marginBottom: 10,
  },
  address: {
    fontSize: 9,
    color: '#555',
    lineHeight: 1.4,
  },
  billTo: {
    marginTop: 30,
    marginBottom: 30,
  },
  billToLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#777',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  billToName: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  table: {
    width: '100%',
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#eee',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tableHeaderCell: {
    padding: 8,
    fontWeight: 'bold',
    fontSize: 8,
    textTransform: 'uppercase',
    color: '#666',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tableCell: {
    padding: 8,
    fontSize: 9,
  },
  tableCellDescription: {
    width: '45%',
  },
  tableCellQty: {
    width: '10%',
    textAlign: 'center',
  },
  tableCellRate: {
    width: '20%',
    textAlign: 'right',
  },
  tableCellAmount: {
    width: '25%',
    textAlign: 'right',
  },
  totals: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  totalsContainer: {
    width: '40%',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  totalLabel: {
    fontSize: 10,
    color: '#666',
  },
  totalValue: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  grandTotalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  grandTotalValue: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#999',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 15,
    left: 0,
    right: 40,
    textAlign: 'right',
    fontSize: 8,
    color: '#999',
  },
  logo: {
    width: 120,
    height: 50,
    marginBottom: 10,
    objectFit: 'contain',
  },
  bankingDetails: {
    marginTop: 40,
    borderWidth: 1,
    borderColor: '#eee',
    padding: 12,
    borderRadius: 4,
    backgroundColor: '#fafafa',
  },
  bankingTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 6,
    textTransform: 'uppercase',
    color: '#555',
  },
  bankingRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  bankingLabel: {
    width: '35%',
    fontSize: 8,
    color: '#777',
  },
  bankingValue: {
    width: '65%',
    fontSize: 8,
    fontWeight: 'bold',
  },
  notesSection: {
    marginTop: 20,
  },
  notesLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#777',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  notesText: {
    fontSize: 9,
    fontStyle: 'italic',
    color: '#555',
    lineHeight: 1.4,
  },
});

function isRenderablePrimitive(value: unknown): value is string | number | boolean {
  return ['string', 'number', 'boolean'].includes(typeof value);
}

function safeText(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  if (isRenderablePrimitive(value)) return String(value);

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    const anyValue = value as any;

    // Handle Firestore timestamp-like objects
    if (typeof anyValue?.toDate === 'function') {
      try {
        const d = anyValue.toDate();
        if (d instanceof Date && !Number.isNaN(d.getTime())) {
          return d.toISOString();
        }
      } catch {
        return fallback;
      }
    }

    // Avoid React element/object rendering crashes
    if (anyValue?.$$typeof || anyValue?._owner || anyValue?.props || anyValue?.type) {
      return fallback;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }

  try {
    return String(value);
  } catch {
    return fallback;
  }
}

function safeNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatPrice(value: unknown): string {
  const price = safeNumber(value, 0);
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
  }).format(price);
}

function safeFormatDate(date: unknown): string {
  try {
    if ((date as any)?.toDate && typeof (date as any).toDate === 'function') {
      const d = (date as any).toDate();
      if (d instanceof Date && !Number.isNaN(d.getTime())) {
        return format(d, 'dd/MM/yyyy');
      }
    }

    if (date instanceof Date && !Number.isNaN(date.getTime())) {
      return format(date, 'dd/MM/yyyy');
    }

    if (typeof date === 'string' || typeof date === 'number') {
      const parsed = new Date(date);
      if (!Number.isNaN(parsed.getTime())) {
        return format(parsed, 'dd/MM/yyyy');
      }
    }

    return 'N/A';
  } catch {
    return 'N/A';
  }
}

function addressLinesFromUnknown(address: unknown): string[] {
  if (!address) return [];

  if (typeof address === 'string') {
    return address
      .split(/\r?\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  if (typeof address === 'object') {
    const a = address as Record<string, unknown>;
    return [
      safeText(a.street),
      safeText(a.suburb),
      safeText(a.city),
      safeText(a.province),
      safeText(a.country),
      safeText(a.zip),
    ].filter(Boolean);
  }

  return [safeText(address)].filter(Boolean);
}

function renderAddress(address: unknown) {
  const lines = addressLinesFromUnknown(address);
  if (!lines.length) return null;

  return (
    <View>
      {lines.map((line, index) => (
        <Text key={`addr-${index}`} style={styles.address}>
          {line}
        </Text>
      ))}
    </View>
  );
}

export function InvoicePdfDocument({
  invoice,
  client,
  customer,
}: {
  invoice: Invoice;
  client: User;
  customer: ClientCustomer;
}) {
  const companyName = safeText(client?.companyName || client?.name, 'Company');
  const logoUrl = typeof client?.logoUrl === 'string' ? client.logoUrl : '';
  const invoiceId = safeText(invoice?.id, 'Unknown');
  const customerName = safeText(customer?.name, 'Customer');
  const notes = safeText(invoice?.notes, '');

  const bankName = safeText(client?.bankingDetails?.bankName, '');
  const accountHolder = safeText(client?.bankingDetails?.accountHolder, '');
  const accountNumber = safeText(client?.bankingDetails?.accountNumber, '');
  const branchCode = safeText(client?.bankingDetails?.branchCode, '');
  const vatNumber = safeText(client?.vatNumber, '');
  const customerVatNumber = safeText(customer?.vatNumber, '');

  const lineItems = Array.isArray(invoice?.lineItems) ? invoice.lineItems : [];

  const hasBankingDetails = Boolean(bankName && accountHolder && accountNumber);

  return (
    <Document title={`Invoice-${invoiceId}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.companyDetails}>
            {logoUrl ? <Image style={styles.logo} src={logoUrl} /> : null}
            <Text style={styles.companyName}>{companyName}</Text>
            {renderAddress((client as any)?.address)}
            {client?.isVatRegistered && vatNumber ? (
              <Text style={styles.address}>VAT Reg: {vatNumber}</Text>
            ) : null}
          </View>

          <View style={styles.invoiceDetails}>
            <Text style={styles.invoiceTitle}>TAX INVOICE</Text>

            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 }}>
                <Text style={{ color: '#777', marginRight: 10 }}>Invoice #:</Text>
                <Text style={{ fontWeight: 'bold' }}>{invoiceId}</Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 }}>
                <Text style={{ color: '#777', marginRight: 10 }}>Date:</Text>
                <Text>{safeFormatDate(invoice?.invoiceDate)}</Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <Text style={{ color: '#777', marginRight: 10 }}>Due Date:</Text>
                <Text>{safeFormatDate(invoice?.dueDate)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.billTo}>
          <Text style={styles.billToLabel}>Bill To:</Text>
          <Text style={styles.billToName}>{customerName}</Text>
          {renderAddress(customer?.address)}
          {customerVatNumber ? <Text style={styles.address}>VAT Reg: {customerVatNumber}</Text> : null}
        </View>

        <View style={styles.table} wrap>
          <View style={styles.tableHeader} fixed>
            <Text style={[styles.tableHeaderCell, styles.tableCellDescription]}>Description</Text>
            <Text style={[styles.tableHeaderCell, styles.tableCellQty]}>Qty</Text>
            <Text style={[styles.tableHeaderCell, styles.tableCellRate]}>Rate (Excl)</Text>
            <Text style={[styles.tableHeaderCell, styles.tableCellAmount]}>Total (Incl)</Text>
          </View>

          {lineItems.map((item, index) => {
            const quantity = safeNumber(item?.quantity, 1);
            const rate = safeNumber(item?.rate, 0);
            const isStandardRate = safeText(item?.vatType) === 'standard_rated_sales';
            const lineExcl = rate * quantity;
            const lineVat = isStandardRate ? lineExcl * 0.15 : 0;
            const lineIncl = lineExcl + lineVat;

            return (
              <View key={`line-${index}`} style={styles.tableRow} wrap={false}>
                <Text style={[styles.tableCell, styles.tableCellDescription]}>
                  {safeText(item?.description, '-')}
                </Text>
                <Text style={[styles.tableCell, styles.tableCellQty]}>{String(quantity)}</Text>
                <Text style={[styles.tableCell, styles.tableCellRate]}>{formatPrice(rate)}</Text>
                <Text style={[styles.tableCell, styles.tableCellAmount, { fontWeight: 'bold' }]}>
                  {formatPrice(lineIncl)}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalsContainer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal (Excl)</Text>
              <Text style={styles.totalValue}>{formatPrice(invoice?.subtotal)}</Text>
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>VAT (15%)</Text>
              <Text style={styles.totalValue}>{formatPrice(invoice?.vat)}</Text>
            </View>

            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Grand Total</Text>
              <Text style={styles.grandTotalValue}>{formatPrice(invoice?.total)}</Text>
            </View>
          </View>
        </View>

        {hasBankingDetails ? (
          <View style={styles.bankingDetails} wrap={false}>
            <Text style={styles.bankingTitle}>Banking Details</Text>

            <View style={styles.bankingRow}>
              <Text style={styles.bankingLabel}>Bank Name:</Text>
              <Text style={styles.bankingValue}>{bankName}</Text>
            </View>

            <View style={styles.bankingRow}>
              <Text style={styles.bankingLabel}>Account Holder:</Text>
              <Text style={styles.bankingValue}>{accountHolder}</Text>
            </View>

            <View style={styles.bankingRow}>
              <Text style={styles.bankingLabel}>Account Number:</Text>
              <Text style={styles.bankingValue}>{accountNumber}</Text>
            </View>

            <View style={styles.bankingRow}>
              <Text style={styles.bankingLabel}>Branch Code:</Text>
              <Text style={styles.bankingValue}>{branchCode}</Text>
            </View>
          </View>
        ) : null}

        {notes ? (
          <View style={styles.notesSection} wrap={false}>
            <Text style={styles.notesLabel}>Notes / Instructions:</Text>
            <Text style={styles.notesText}>{notes}</Text>
          </View>
        ) : null}

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />

        <View style={styles.footer} fixed>
          <Text>Thank you for your business!</Text>
        </View>
      </Page>
    </Document>
  );
}