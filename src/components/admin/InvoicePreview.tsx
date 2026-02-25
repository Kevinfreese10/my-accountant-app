
'use client';

import { Invoice, ClientCustomer, User } from "@/lib/types";
import { format } from 'date-fns';
import Image from "next/image";
import React from "react";

const formatPrice = (price: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(price);

const InvoicePreview = React.forwardRef<HTMLDivElement, { invoice: Invoice, client: User | null, customer: ClientCustomer | undefined }>(({ invoice, client, customer }, ref) => {
    if (!invoice || !client || !customer) return null;
    
    const getVatAmount = (lineItem: { rate: number, quantity: number, vatType: string }) => {
        if (lineItem.vatType === 'standard_rated_sales') {
            return (lineItem.rate * lineItem.quantity) * 0.15;
        }
        return 0;
    };
    
    const hasBankingDetails = !!(client.bankingDetails && client.bankingDetails.bankName && client.bankingDetails.accountHolder && client.bankingDetails.accountNumber);
    
    const renderAddress = (address: any) => {
        if (!address) return null;

        // Handle string address (legacy)
        if (typeof address === 'string') {
            const parts = address.split(',').map(part => part.trim());
            return (
                <div className="text-sm text-gray-600">
                    {parts.map((part, index) => (
                        <p key={index}>{part}</p>
                    ))}
                </div>
            );
        }

        // Handle object address
        return (
             <div className="text-sm text-gray-600">
                {address.street && <p>{address.street}</p>}
                {address.suburb && <p>{address.suburb}</p>}
                {address.city && <p>{address.city}</p>}
                {address.province && <p>{address.province}</p>}
                {address.zip && <p>{address.zip}</p>}
            </div>
        )
    };

    return (
        <div ref={ref} className="p-8 bg-white text-gray-800 rounded-lg shadow-inner border max-h-[80vh] overflow-y-auto">
            <header className="flex justify-between items-start mb-10">
                {/* Left Column */}
                <div className="w-1/2 space-y-6">
                    <div className="space-y-1">
                        {client.logoUrl && (
                            <div className="relative h-20 w-48 mb-4">
                                <Image src={client.logoUrl} alt={`${client.companyName || client.name} Logo`} fill className="object-contain object-left"/>
                            </div>
                        )}
                        <h1 className="text-3xl font-bold text-gray-900">{client.companyName || client.name}</h1>
                        {renderAddress(client.address)}
                        {client.isVatRegistered && client.vatNumber && <p className="text-sm text-gray-600">VAT Reg: {client.vatNumber}</p>}
                    </div>

                    <div className="space-y-1">
                        <p className="text-sm font-semibold text-gray-600">Bill To:</p>
                        <p className="text-lg font-bold text-gray-800">{customer.name}</p>
                        {renderAddress(customer.address)}
                        {customer.vatNumber && <p className="text-sm text-gray-600">VAT Reg: {customer.vatNumber}</p>}
                    </div>
                </div>

                {/* Right Column */}
                <div className="w-1/2 text-right space-y-4">
                    <h2 className="text-4xl font-extrabold uppercase text-gray-400">Tax Invoice</h2>
                     <div className="grid grid-cols-[auto_1fr] gap-x-4 text-sm justify-end">
                        <span className="font-semibold text-gray-600 text-right">Invoice Number:</span>
                        <span className="text-left ml-2">{invoice.id}</span>
                        <span className="font-semibold text-gray-600 text-right">Date:</span>
                        <span className="text-left ml-2">{format(invoice.invoiceDate, 'dd/MM/yyyy')}</span>
                        <span className="font-semibold text-gray-600 text-right">Due Date:</span>
                        <span className="text-left ml-2">{format(invoice.dueDate, 'dd/MM/yyyy')}</span>
                    </div>

                    {hasBankingDetails && (
                        <div className="border-t pt-4 mt-4 space-y-1">
                            <p className="text-sm font-semibold text-gray-600 text-right">Banking Details:</p>
                             <div className="grid grid-cols-[auto_1fr] text-sm justify-end gap-x-2">
                                <span className="font-medium text-gray-600 text-right">Bank:</span>
                                <span className="text-left">{client.bankingDetails?.bankName}</span>
                                <span className="font-medium text-gray-600 text-right">Account Holder:</span>
                                <span className="text-left">{client.bankingDetails?.accountHolder}</span>
                                <span className="font-medium text-gray-600 text-right">Account Number:</span>
                                <span className="text-left">{client.bankingDetails?.accountNumber}</span>
                                <span className="font-medium text-gray-600 text-right">Branch Code:</span>
                                <span className="text-left">{client.bankingDetails?.branchCode}</span>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            <section className="mb-10">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-100 text-gray-600 uppercase text-[10px]">
                            <th className="p-3 border">Description</th>
                            <th className="p-3 text-center border">Qty</th>
                            <th className="p-3 text-right border">Rate (Excl)</th>
                            <th className="p-3 text-right border">VAT</th>
                            <th className="p-3 text-right border">Total (Incl)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {invoice.lineItems.map((item, index) => {
                            const vatAmount = getVatAmount(item);
                            const totalAmount = (item.rate * item.quantity) + vatAmount;
                            return (
                                <tr key={index} className="border-b border-gray-200 text-xs">
                                    <td className="p-3 border">{item.description}</td>
                                    <td className="p-3 text-center border">{item.quantity}</td>
                                    <td className="p-3 text-right border font-mono">{formatPrice(item.rate)}</td>
                                    <td className="p-3 text-right border font-mono">{formatPrice(vatAmount)}</td>
                                    <td className="p-3 text-right border font-semibold font-mono">{formatPrice(totalAmount)}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </section>

            <section className="flex justify-end mb-10">
                <div className="w-full max-w-sm space-y-2">
                    <div className="flex justify-between text-gray-600 text-sm">
                        <span>Subtotal (Excl)</span>
                        <span className="font-mono">{formatPrice(invoice.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 text-sm">
                        <span>Total VAT (15%)</span>
                        <span className="font-mono">{formatPrice(invoice.vat)}</span>
                    </div>
                    <div className="flex justify-between text-xl font-bold text-gray-900 border-t pt-3 mt-3">
                        <span>Grand Total</span>
                        <span className="font-mono">{formatPrice(invoice.total)}</span>
                    </div>
                </div>
            </section>

            {invoice.notes && (
                <section className="mb-10 p-4 bg-gray-50 rounded border border-dashed">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Internal Notes / Payment Instructions</h3>
                    <p className="text-sm text-gray-600 italic whitespace-pre-wrap">{invoice.notes}</p>
                </section>
            )}

            <footer className="text-center text-[10px] text-gray-400 border-t pt-6">
                <p>Generated by My Accountant AI Engine. Thank you for your business!</p>
            </footer>
        </div>
    );
});

InvoicePreview.displayName = 'InvoicePreview';

export default InvoicePreview;
