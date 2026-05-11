
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
import { Order, Service, User } from '@/lib/types';

interface DocumentRequestEmailProps {
  order: Order;
  items: { service: Service }[];
  reseller?: User;
  replyTo: string;
}

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
  paddingTop: '12px',
  paddingBottom: '12px',
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
  color: '#333'
}

export const DocumentRequestEmail = ({ order, items, reseller, replyTo }: DocumentRequestEmailProps) => {
    const previewText = `Action Required for Order #${order.id}`;

    const companyName = reseller?.companyName || 'My Accountant';
    const companyEmail = reseller?.email || 'info@myacc.co.za';
    
    let companyAddress = 'Ground Floor, Waterstone Building, Stonemill Office Park, 300 Acacia Road, Darrenwood, Johannesburg, 2195';
    if (reseller?.address) {
        const addr = reseller.address;
        companyAddress = [addr.street, addr.suburb, addr.city, addr.province, addr.zip].filter(Boolean).join(', ');
    }

    return (
        <Html>
        <Head />
        <Preview>{previewText}</Preview>
        <Body style={main}>
            <Container style={container}>
            <Section style={box}>
                <Heading style={heading}>Finalize Your Order Details</Heading>
                <Text style={paragraph}>
                    Hi {(order.endCustomerName || order.customerName).split(' ')[0]},
                </Text>
                <Text style={paragraph}>
                    We have received payment confirmation for your order <strong style={{color: '#214392'}}>#{order.id}</strong>.
                </Text>
                <Text style={paragraph}>
                    To begin processing your request, please click the button below to log in to your dashboard and securely upload the required documents.
                </Text>
                
                <Button style={button} href={`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/orders/${order.id}`}>
                    Go to My Dashboard
                </Button>
                
                <Hr style={hr} />
                
                <Text style={paragraph}>
                    If you have any questions, please reply directly to this email or contact us at <a href={`mailto:${replyTo}`} style={anchor}>{replyTo}</a>.
                </Text>
                
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

export default DocumentRequestEmail;
