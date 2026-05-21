import { NextResponse } from 'next/server';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { InvoicePdfDocument } from '@/server/pdf/InvoicePdfDocument';

export const runtime = 'nodejs';

function getValueType(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'date';
  return typeof value;
}

function summarizePayload(invoice: any, client: any, customer: any) {
  return {
    invoiceId: invoice?.id,
    invoiceDateType: getValueType(invoice?.invoiceDate),
    dueDateType: getValueType(invoice?.dueDate),
    notesType: getValueType(invoice?.notes),
    subtotalType: getValueType(invoice?.subtotal),
    vatType: getValueType(invoice?.vat),
    totalType: getValueType(invoice?.total),
    lineItemsType: getValueType(invoice?.lineItems),
    firstLineItem: invoice?.lineItems?.[0]
      ? {
          descriptionType: getValueType(invoice.lineItems[0]?.description),
          quantityType: getValueType(invoice.lineItems[0]?.quantity),
          rateType: getValueType(invoice.lineItems[0]?.rate),
          vatTypeType: getValueType(invoice.lineItems[0]?.vatType),
        }
      : null,
    clientNameType: getValueType(client?.name),
    clientCompanyNameType: getValueType(client?.companyName),
    clientAddressType: getValueType(client?.address),
    clientLogoUrlType: getValueType(client?.logoUrl),
    bankingDetailsType: getValueType(client?.bankingDetails),
    customerNameType: getValueType(customer?.name),
    customerAddressType: getValueType(customer?.address),
    customerVatNumberType: getValueType(customer?.vatNumber),
  };
}

export async function POST(req: Request, context: { params: Promise<{ invoiceId: string }> }) {
  try {
    const { invoice, client, customer } = await req.json();
    const { invoiceId } = await context.params;

    if (!invoice || !client || !customer) {
      return NextResponse.json(
        { error: 'Missing invoice, client, or customer data' },
        { status: 400 }
      );
    }

    console.log(`API Route: Generating PDF for Invoice ID: ${invoiceId}`);
    console.log('API Route: PDF payload summary:', summarizePayload(invoice, client, customer));

    const element = React.createElement(InvoicePdfDocument, {
      invoice,
      client,
      customer,
    });

    const buffer = await renderToBuffer(element as any);

    console.log('API Route: PDF buffer created, size:', buffer.length);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=Invoice-${invoice?.id ?? invoiceId}.pdf`,
      },
    });
  } catch (err: any) {
    console.error('PDF Generation API Error:', err);

    return NextResponse.json(
      {
        error: err?.message ?? 'PDF generation failed',
        details: err?.stack ?? null,
      },
      { status: 500 }
    );
  }
}