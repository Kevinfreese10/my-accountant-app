
import { NextResponse } from 'next/server';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { InvoicePdfDocument } from '@/server/pdf/InvoicePdfDocument';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { invoiceId: string } }) {
  try {
    const { invoice, client, customer } = await req.json();

    if (!invoice || !client || !customer) {
      return NextResponse.json(
        { error: 'Missing invoice, client, or customer data' },
        { status: 400 }
      );
    }

    console.log(`API Route: Generating PDF for Invoice ID: ${params.invoiceId}`);

    // Use React.createElement to avoid JSX syntax in a .ts file
    const element = React.createElement(InvoicePdfDocument, {
      invoice,
      client,
      customer,
    });

    const buffer = await renderToBuffer(element);

    console.log('API Route: PDF buffer created, size:', buffer.length);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=Invoice-${invoice.id}.pdf`,
      },
    });
  } catch (err: any) {
    console.error('PDF Generation API Error:', err);
    return NextResponse.json(
      { error: err.message ?? 'PDF generation failed', stack: err.stack },
      { status: 500 }
    );
  }
}
