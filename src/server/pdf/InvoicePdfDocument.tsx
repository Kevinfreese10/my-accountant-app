
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font, Image } from '@react-pdf/renderer';
import { Invoice, ClientCustomer, User } from '@/lib/types';
import { format } from 'date-fns';

// Register fonts
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

const formatPrice = (price?: number): string => {
  if (price === undefined || price === null || isNaN(price)) return 'R 0.00';
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(price);
};

const safeFormatDate = (date: any): string => {
  try {
    if (date?.toDate && typeof date.toDate === 'function') {
      return format(date.toDate(), 'dd/MM/yyyy');
    }
    if (typeof date === 'string' || typeof date === 'number') {
      const parsedDate = new Date(date);
      if (!isNaN(parsedDate.getTime())) {
        return format(parsedDate, 'dd/MM/yyyy');
      }
    }
    return 'N/A';
  } catch {
    return 'Invalid Date';
  }
};

const renderAddress = (address: any) => {
    if (!address) return null;
    if (typeof address === 'string') {
        return <Text style={styles.address}>{address.replace(/, /g, '\n')}</Text>;
    }
    return (
        <View style={styles.address}>
            {address.street && <Text>{address.street}</Text>}
            {address.suburb && <Text>{address.suburb}</Text>}
            {address.city && <Text>{address.city}</Text>}
            {address.province && <Text>{address.province}</Text>}
            {address.zip && <Text>{address.zip}</Text>}
        </View>
    );
};

export function InvoicePdfDocument({ invoice, client, customer }: { invoice: Invoice; client: User; customer: ClientCustomer }) {
  const hasBankingDetails = !!(client.bankingDetails && client.bankingDetails.bankName && client.bankingDetails.accountHolder && client.bankingDetails.accountNumber);

  return (
    <Document title={`Invoice-${invoice.id}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.companyDetails}>
            {client.logoUrl && <Image style={styles.logo} src={client.logoUrl} />}
            <Text style={styles.companyName}>{client.companyName || client.name}</Text>
            {renderAddress(client.address)}
            {client.isVatRegistered && client.vatNumber && <Text style={styles.address}>VAT Reg: {client.vatNumber}</Text>}
          </View>
          <View style={styles.invoiceDetails}>
            <Text style={styles.invoiceTitle}>TAX INVOICE</Text>
            <View style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
                <Text style={{ color: '#777' }}>Invoice #:</Text>
                <Text style={{ fontWeight: 'bold' }}>{invoice.id}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
                <Text style={{ color: '#777' }}>Date:</Text>
                <Text>{safeFormatDate(invoice.invoiceDate)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
                <Text style={{ color: '#777' }}>Due Date:</Text>
                <Text>{safeFormatDate(invoice.dueDate)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.billTo}>
            <Text style={styles.billToLabel}>Bill To:</Text>
            <Text style={styles.billToName}>{customer.name}</Text>
            {renderAddress(customer.address)}
            {customer.vatNumber && <Text style={styles.address}>VAT Reg: {customer.vatNumber}</Text>}
        </View>

        <View style={styles.table} wrap>
          <View style={styles.tableHeader} fixed>
            <Text style={[styles.tableHeaderCell, styles.tableCellDescription]}>Description</Text>
            <Text style={[styles.tableHeaderCell, styles.tableCellQty]}>Qty</Text>
            <Text style={[styles.tableHeaderCell, styles.tableCellRate]}>Rate (Excl)</Text>
            <Text style={[styles.tableHeaderCell, styles.tableCellAmount]}>Total (Incl)</Text>
          </View>
          {invoice.lineItems.map((item, index) => {
             const isStandardRate = item.vatType === 'standard_rated_sales';
             const lineExcl = (item.rate || 0) * (item.quantity || 1);
             const lineVat = isStandardRate ? lineExcl * 0.15 : 0;
             const lineIncl = lineExcl + lineVat;
            return (
              <View key={index} style={styles.tableRow} wrap={false}>
                <Text style={[styles.tableCell, styles.tableCellDescription]}>{item.description}</Text>
                <Text style={[styles.tableCell, styles.tableCellQty]}>{item.quantity}</Text>
                <Text style={[styles.tableCell, styles.tableCellRate]}>{formatPrice(item.rate)}</Text>
                <Text style={[styles.tableCell, styles.tableCellAmount, { fontWeight: 'bold' }]}>{formatPrice(lineIncl)}</Text>
              </View>
            )
          })}
        </View>

        <View style={styles.totals}>
            <View style={styles.totalsContainer}>
                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Subtotal (Excl)</Text>
                    <Text style={styles.totalValue}>{formatPrice(invoice.subtotal)}</Text>
                </View>
                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>VAT (15%)</Text>
                    <Text style={styles.totalValue}>{formatPrice(invoice.vat)}</Text>
                </View>
                <View style={styles.grandTotalRow}>
                    <Text style={styles.grandTotalLabel}>Grand Total</Text>
                    <Text style={styles.grandTotalValue}>{formatPrice(invoice.total)}</Text>
                </View>
            </View>
        </View>

        {hasBankingDetails && (
            <View style={styles.bankingDetails} wrap={false}>
                <Text style={styles.bankingTitle}>Banking Details</Text>
                <View style={styles.bankingRow}>
                    <Text style={styles.bankingLabel}>Bank Name:</Text>
                    <Text style={styles.bankingValue}>{client.bankingDetails!.bankName}</Text>
                </View>
                <View style={styles.bankingRow}>
                    <Text style={styles.bankingLabel}>Account Holder:</Text>
                    <Text style={styles.bankingValue}>{client.bankingDetails!.accountHolder}</Text>
                </View>
                <View style={styles.bankingRow}>
                    <Text style={styles.bankingLabel}>Account Number:</Text>
                    <Text style={styles.bankingValue}>{client.bankingDetails!.accountNumber}</Text>
                </View>
                <View style={styles.bankingRow}>
                    <Text style={styles.bankingLabel}>Branch Code:</Text>
                    <Text style={styles.bankingValue}>{client.bankingDetails!.branchCode}</Text>
                </View>
            </View>
        )}

        {invoice.notes && (
            <View style={styles.notesSection} wrap={false}>
                <Text style={styles.notesLabel}>Notes / Instructions:</Text>
                <Text style={styles.notesText}>{invoice.notes}</Text>
            </View>
        )}

        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
        <View style={styles.footer} fixed>
          <Text>Thank you for your business!</Text>
        </View>
      </Page>
    </Document>
  );
}
