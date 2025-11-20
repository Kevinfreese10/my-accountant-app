
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
                {address.country && <p>{address.country}</p>}
                {address.zip && <p>{address.zip}</p>}
            </div>
        )
    };

    return (
        <div ref={ref} className="p-8 bg-white text-gray-800 max-h-[80vh] overflow-y-auto">
            <header className="flex justify-between items-start mb-10">
                <div className="space-y-1">
                    {client.logoUrl && (
                        <div className="relative h-20 w-48 mb-4">
                            <Image src={client.logoUrl} alt={`${client.companyName || client.name} Logo`} fill className="object-contain object-left"/>
                        </div>
                    )}
                    <h1 className="text-3xl font-bold text-gray-900">{client.companyName || client.name}</h1>
                    <div className="text-sm text-gray-600 max-w-xs">
                        {renderAddress(client.address)}
                    </div>
                    {client.isVatRegistered && client.vatNumber && <p className="text-sm text-gray-600">VAT Reg: {client.vatNumber}</p>}
                </div>
                <div className="text-right space-y-2">
                    <h2 className="text-4xl font-extrabold uppercase text-gray-400">Tax Invoice</h2>
                    <p className="text-sm text-gray-600 mt-1">Invoice Number: <span className="font-semibold">{invoice.id}</span></p>
                    <div className="grid grid-cols-2 gap-x-4 text-sm">
                        <span className="font-semibold text-gray-600">Date:</span>
                        <span>{format(invoice.invoiceDate, 'dd/MM/yyyy')}</span>
                        <span className="font-semibold text-gray-600">Due Date:</span>
                        <span>{format(invoice.dueDate, 'dd/MM/yyyy')}</span>
                    </div>
                </div>
            </header>

            <section className="flex justify-between items-start mb-10">
                <div className="space-y-1">
                    <p className="text-sm font-semibold text-gray-600">Bill To:</p>
                    <p className="text-lg font-bold text-gray-800">{customer.name}</p>
                    {renderAddress(customer.address)}
                    {customer.vatNumber && <p className="text-sm text-gray-600">VAT Reg: {customer.vatNumber}</p>}
                </div>
            </section>

            <section className="mb-10">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-gray-100 text-gray-600 uppercase text-sm">
                            <th className="p-3">Description</th>
                            <th className="p-3 text-center">Qty</th>
                            <th className="p-3 text-right">Amount Excluding VAT</th>
                            <th className="p-3 text-right">VAT Amount</th>
                            <th className="p-3 text-right">Total Including VAT</th>
                        </tr>
                    </thead>
                    <tbody>
                        {invoice.lineItems.map((item, index) => {
                            const vatAmount = getVatAmount(item);
                            const totalAmount = (item.rate * item.quantity) + vatAmount;
                            return (
                                <tr key={index} className="border-b border-gray-200">
                                    <td className="p-3">{item.description}</td>
                                    <td className="p-3 text-center">{item.quantity}</td>
                                    <td className="p-3 text-right">{formatPrice(item.rate * item.quantity)}</td>
                                    <td className="p-3 text-right">{formatPrice(vatAmount)}</td>
                                    <td className="p-3 text-right font-semibold">{formatPrice(totalAmount)}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </section>

            <section className="flex justify-end mb-10">
                <div className="w-full max-w-sm space-y-3">
                    <div className="flex justify-between text-gray-600">
                        <span>Subtotal</span>
                        <span>{formatPrice(invoice.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                        <span>VAT (15%)</span>
                        <span>{formatPrice(invoice.vat)}</span>
                    </div>
                    <div className="flex justify-between text-xl font-bold text-gray-900 border-t pt-3 mt-3">
                        <span>Total Due</span>
                        <span>{formatPrice(invoice.total)}</span>
                    </div>
                </div>
            </section>

            {invoice.notes && (
                <section className="mb-10">
                    <h3 className="font-semibold text-gray-700 mb-2">Notes</h3>
                    <p className="text-sm text-gray-600 italic">{invoice.notes}</p>
                </section>
            )}

            {hasBankingDetails && (
                <footer className="text-center text-sm text-gray-500 border-t pt-6">
                    <p className="font-semibold">Banking Details</p>
                    <p>{client.bankingDetails?.bankName} | Account: {client.bankingDetails?.accountNumber} | Branch: {client.bankingDetails?.branchCode}</p>
                    <p>Thank you for your business!</p>
                </footer>
            )}
        </div>
    );
});

InvoicePreview.displayName = 'InvoicePreview';

export default InvoicePreview;
