
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
  },
  invoiceTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#999',
    marginBottom: 10,
  },
  address: {
    fontSize: 9,
    color: '#555',
  },
  billTo: {
    marginTop: 20,
  },
  billToName: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  table: {
    width: '100%',
    marginTop: 20,
    border: '1px solid #eee',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f3f3',
    borderBottom: '1px solid #eee',
  },
  tableHeaderCell: {
    padding: 8,
    fontWeight: 'bold',
    fontSize: 9,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #eee',
  },
  tableCell: {
    padding: 8,
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
    width: '45%',
    spaceY: 2,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  totalLabel: {
    fontSize: 10,
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
    borderTop: '1px solid #ccc',
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
    borderTop: '1px solid #eee',
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
    width: 150,
    height: 60,
    marginBottom: 10,
  },
  bankingDetails: {
    marginTop: 30,
    border: '1px solid #eee',
    padding: 10,
    borderRadius: 5,
  },
  bankingTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  bankingRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  bankingLabel: {
    width: '40%',
    fontWeight: 'bold',
  },
  bankingValue: {
    width: '60%',
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
            {address.country && <Text>{address.country}</Text>}
            {address.zip && <Text>{address.zip}</Text>}
        </View>
    );
};

export function InvoicePdfDocument({ invoice, client, customer }: { invoice: Invoice; client: User; customer: ClientCustomer }) {
  const hasBankingDetails = !!(client.bankingDetails && client.bankingDetails.bankName && client.bankingDetails.accountHolder && client.bankingDetails.accountNumber);

  return (
    <Document>
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
            <View>
              <Text>Invoice Number: {invoice.id}</Text>
              <Text>Date: {safeFormatDate(invoice.invoiceDate)}</Text>
              <Text>Due Date: {safeFormatDate(invoice.dueDate)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.billTo}>
            <Text style={styles.billToName}>{customer.name}</Text>
            {renderAddress(customer.address)}
            {customer.vatNumber && <Text style={styles.address}>VAT Reg: {customer.vatNumber}</Text>}
        </View>

        <View style={styles.table} wrap>
          <View style={styles.tableHeader} fixed>
            <Text style={[styles.tableHeaderCell, styles.tableCellDescription]}>Description</Text>
            <Text style={[styles.tableHeaderCell, styles.tableCellQty]}>Qty</Text>
            <Text style={[styles.tableHeaderCell, styles.tableCellRate]}>Rate</Text>
            <Text style={[styles.tableHeaderCell, styles.tableCellAmount]}>Amount</Text>
          </View>
          {invoice.lineItems.map((item, index) => {
             const lineTotal = (item.rate || 0) * (item.quantity || 1);
            return (
              <View key={index} style={styles.tableRow} wrap={false}>
                <Text style={[styles.tableCell, styles.tableCellDescription]}>{item.description}</Text>
                <Text style={[styles.tableCell, styles.tableCellQty]}>{item.quantity}</Text>
                <Text style={[styles.tableCell, styles.tableCellRate]}>{formatPrice(item.rate)}</Text>
                <Text style={[styles.tableCell, styles.tableCellAmount]}>{formatPrice(lineTotal)}</Text>
              </View>
            )
          })}
        </View>

        <View style={styles.totals}>
            <View style={styles.totalsContainer}>
                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Subtotal</Text>
                    <Text style={styles.totalValue}>{formatPrice(invoice.subtotal)}</Text>
                </View>
                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>VAT (15%)</Text>
                    <Text style={styles.totalValue}>{formatPrice(invoice.vat)}</Text>
                </View>
                <View style={styles.grandTotalRow}>
                    <Text style={styles.grandTotalLabel}>Total Due</Text>
                    <Text style={styles.grandTotalValue}>{formatPrice(invoice.total)}</Text>
                </View>
            </View>
        </View>

        {hasBankingDetails && (
            <View style={styles.bankingDetails}>
                <Text style={styles.bankingTitle}>Banking Details</Text>
                <View style={styles.bankingRow}><Text style={styles.bankingLabel}>Account Holder:</Text><Text style={styles.bankingValue}>{client.bankingDetails!.accountHolder}</Text></View>
                <View style={styles.bankingRow}><Text style={styles.bankingLabel}>Bank:</Text><Text style={styles.bankingValue}>{client.bankingDetails!.bankName}</Text></View>
                <View style={styles.bankingRow}><Text style={styles.bankingLabel}>Account Number:</Text><Text style={styles.bankingValue}>{client.bankingDetails!.accountNumber}</Text></View>
                <View style={styles.bankingRow}><Text style={styles.bankingLabel}>Branch Code:</Text><Text style={styles.bankingValue}>{client.bankingDetails!.branchCode}</Text></View>
            </View>
        )}

        {invoice.notes && <Text style={{ marginTop: 20, fontSize: 9, fontStyle: 'italic' }}>Notes: {invoice.notes}</Text>}

        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
        <View style={styles.footer} fixed>
          <Text>Thank you for your business!</Text>
        </View>
      </Page>
    </Document>
  );
}
