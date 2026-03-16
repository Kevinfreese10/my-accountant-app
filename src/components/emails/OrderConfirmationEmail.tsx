import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
  Link,
  Button,
} from '@react-email/components';
import * as React from 'react';
import { Order, User } from '@/lib/types';

interface OrderConfirmationEmailProps {
  order: Order;
  reseller?: User;
  isNewUser?: boolean;
  generatedPassword?: string | null;
  showPaymentButton?: boolean;
}

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
};

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
};

const box = {
  padding: '0 48px',
};

const hr = {
  borderColor: '#e6ebf1',
  margin: '20px 0',
};

const paragraph = {
  color: '#525f7f',
  fontSize: '16px',
  lineHeight: '24px',
  textAlign: 'left' as const,
};

const anchor = {
  color: '#214392',
};

const button = {
  backgroundColor: '#214392',
  borderRadius: '5px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  width: '100%',
  padding: '12px',
};

const footer = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
};

const heading = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  marginBottom: '20px',
  textAlign: 'left' as const,
  color: '#333',
}

export const OrderConfirmationEmail = ({ order, reseller, isNewUser, generatedPassword, showPaymentButton = false }: OrderConfirmationEmailProps) => {
    const previewText = `Order Confirmation #${order.id}`;
    
    const customerDisplayName = reseller ? (order.endCustomerName || order.customerName) : order.customerName;
    const customerFirstName = customerDisplayName?.split(' ')[0] || 'Client';

    const companyName = reseller?.companyName || 'My Accountant';
    const companyEmail = reseller?.email || 'info@myacc.co.za';
    
    let companyAddress = '369 Oak Avenue, Ferndale, Randburg';
    if (reseller?.address) {
        const addr = reseller.address;
        companyAddress = [addr.street, addr.suburb, addr.city, addr.province, addr.zip].filter(Boolean).join(', ');
    }
    
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.myacc.co.za';
    const refundPolicyUrl = reseller?.landingPage?.slug 
        ? `${siteUrl}/p/${reseller.landingPage.slug}/refund-policy`
        : `${siteUrl}/refund-policy`;

    return (
        <Html>
        <Head />
        <Preview>{previewText}</Preview>
        <Body style={main}>
            <Container style={container}>
            <Section style={box}>
                <Heading style={heading}>Thank You For Your Order!</Heading>
                <Text style={paragraph}>
                    Hi {customerFirstName},
                </Text>

                {isNewUser && generatedPassword && (
                    <Section style={{ border: '1px solid #e6ebf1', borderRadius: '5px', padding: '20px', backgroundColor: '#f0f7ff', marginTop: '20px', marginBottom: '20px' }}>
                        <Text style={{ ...paragraph, fontWeight: 'bold', color: '#214392', marginBottom: '10px' }}>Your Login Credentials</Text>
                        <Text style={paragraph}>An account has been created for you to track your order and upload documents.</Text>
                        <Text style={{ ...paragraph, margin: '0 0 4px 0', fontSize: '14px' }}><strong>Login Email:</strong> {order.customerEmail}</Text>
                        <Text style={{ ...paragraph, margin: '0 0 4px 0', fontSize: '14px' }}><strong>Temporary Password:</strong> {generatedPassword}</Text>
                        <Text style={{ ...paragraph, fontSize: '12px', fontStyle: 'italic', marginTop: '10px' }}>Please change your password after logging in for the first time.</Text>
                    </Section>
                )}

                {!isNewUser && !reseller && (
                    <Text style={paragraph}>
                        You can log in to your existing account using your email <strong>{order.customerEmail}</strong> to view your order status.
                    </Text>
                )}

                <Text style={paragraph}>
                    Thank you for your order with {companyName}. Your order <strong style={{color: '#214392'}}>{order.id}</strong> has been successfully placed.
                </Text>
                
                {!reseller ? (
                    <>
                        <Text style={paragraph}>
                            {showPaymentButton 
                                ? "Please click the button below to complete your payment." 
                                : "You will be redirected to PayFast to complete your payment."}
                        </Text>

                        {showPaymentButton && (
                            <Button style={button} href={`${siteUrl}/order-confirmation/${order.id}`}>
                                Pay Now
                            </Button>
                        )}
                    </>
                ) : (
                    reseller.bankingDetails?.bankName && (
                        <Section style={{ border: '1px solid #e6ebf1', borderRadius: '5px', padding: '20px', backgroundColor: '#fafafa', marginTop: '20px' }}>
                            <Text style={{ ...paragraph, fontWeight: 'bold', marginBottom: '10px' }}>Payment Instructions (EFT):</Text>
                            <Text style={{ ...paragraph, margin: '0 0 4px 0', fontSize: '14px' }}><strong>Bank:</strong> {reseller.bankingDetails.bankName}</Text>
                            <Text style={{ ...paragraph, margin: '0 0 4px 0', fontSize: '14px' }}><strong>Account Holder:</strong> {reseller.bankingDetails.accountHolder}</Text>
                            <Text style={{ ...paragraph, margin: '0 0 4px 0', fontSize: '14px' }}><strong>Account Number:</strong> {reseller.bankingDetails.accountNumber}</Text>
                            <Text style={{ ...paragraph, margin: '0 0 4px 0', fontSize: '14px' }}><strong>Branch Code:</strong> {reseller.bankingDetails.branchCode}</Text>
                            <Text style={{ ...paragraph, margin: '10px 0 0 0', color: '#c00', fontSize: '14px', fontWeight: 'bold' }}><strong>EFT Reference:</strong> {order.id}</Text>
                        </Section>
                    )
                )}
                
                <Hr style={hr} />
                <Text style={{ ...paragraph, fontWeight: 'bold' }}>
                    Order Summary:
                </Text>
                <table style={{ width: '100%', marginBottom: '20px' }}>
                    <tbody>
                    {order.items.map((item: any) => (
                        <tr key={item.id}>
                        <td style={{ padding: '8px 0' }}><Text style={{ ...paragraph, margin: 0 }}>{item.title} (x{item.quantity})</Text></td>
                        <td align="right" style={{ padding: '8px 0' }}><Text style={{ ...paragraph, margin: 0, fontWeight: 'bold' }}>{formatPrice(item.clientPrice || item.price)}</Text></td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                <Hr style={hr} />
                <table style={{ width: '100%' }}>
                    <tbody>
                        <tr>
                        <td><Text style={{ ...paragraph, fontWeight: 'bold', fontSize: '18px' }}>Total Due</Text></td>
                        <td align="right"><Text style={{ ...paragraph, fontWeight: 'bold', fontSize: '18px', color: '#214392' }}>{formatPrice(order.clientTotal || order.total)}</Text></td>
                        </tr>
                    </tbody>
                </table>
                <Hr style={hr} />
                
                <Text style={{...paragraph, fontSize: '14px', marginTop: '20px'}}>
                    By making payment, you accept our <Link href={refundPolicyUrl} style={anchor}>Refund Policy</Link>.
                </Text>
                
                <Hr style={hr} />

                <Text style={paragraph}>
                    Regards,
                    <br />
                    The {companyName} Team
                </Text>

                <Text style={footer}>
                    {companyName} | <a href={`mailto:${companyEmail}`} style={anchor}>{companyEmail}</a> | {companyAddress}
                </Text>
                <Text style={footer}>
                    © {new Date().getFullYear()} {companyName}. All rights reserved.
                </Text>
            </Section>
            </Container>
        </Body>
        </Html>
    );
}

export default OrderConfirmationEmail;