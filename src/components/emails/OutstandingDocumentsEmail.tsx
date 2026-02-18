
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
  Button,
} from '@react-email/components';
import * as React from 'react';

interface OutstandingDocumentsEmailProps {
  clientName: string;
  orderId: string;
  orderUrl: string;
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
  color: '#333'
}

export const OutstandingDocumentsEmail = ({ clientName, orderId, orderUrl }: OutstandingDocumentsEmailProps) => {
    const previewText = `Action Required: Outstanding Documents for Order #${orderId}`;

    return (
        <Html>
        <Head />
        <Preview>{previewText}</Preview>
        <Body style={main}>
            <Container style={container}>
            <Section style={box}>
                <Heading style={heading}>Outstanding Documents Required</Heading>
                <Text style={paragraph}>
                    Hi {clientName.split(' ')[0]},
                </Text>
                <Text style={paragraph}>
                    There are still documents outstanding on your order <strong>#{orderId}</strong> that we need before we can start processing it.
                </Text>
                <Text style={paragraph}>
                    Please log in to your dashboard to view the requirements and upload the necessary documents so we can proceed with your order as quickly as possible.
                </Text>
                
                <Button style={button} href={orderUrl}>
                    Log In to View Order
                </Button>

                <Hr style={hr} />
                
                <Text style={paragraph}>
                    Regards,
                    <br />
                    The My Accountant Team
                </Text>
                
                <Text style={footer}>
                     My Accountant | <a href="mailto:info@myacc.co.za">info@myacc.co.za</a> | 369 Oak Avenue, Ferndale, Randburg
                </Text>
            </Section>
            </Container>
        </Body>
        </Html>
    );
}

export default OutstandingDocumentsEmail;
