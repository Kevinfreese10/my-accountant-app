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

interface NewNoteNotificationEmailProps {
  recipientName: string;
  senderName: string;
  orderId: string;
  notePreview: string;
  actionUrl: string;
  isToClient: boolean;
  resellerName?: string;
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

export const NewNoteNotificationEmail = ({ recipientName, senderName, orderId, notePreview, actionUrl, isToClient, resellerName }: NewNoteNotificationEmailProps) => {
    const previewText = `New note on Order #${orderId}`;
    const headingText = isToClient ? "New Note on Your Order" : "Client Left a New Note";

    return (
        <Html>
        <Head />
        <Preview>{previewText}</Preview>
        <Body style={main}>
            <Container style={container}>
            <Section style={box}>
                <Heading style={heading}>{headingText}</Heading>
                <Text style={paragraph}>
                    Hi {recipientName.split(' ')[0]},
                </Text>
                <Text style={paragraph}>
                    {senderName} has left a new note on order <strong>#{orderId}</strong>:
                </Text>
                <Section style={{ border: '1px solid #e6ebf1', borderRadius: '5px', padding: '20px', backgroundColor: '#fafafa', marginTop: '20px', fontStyle: 'italic' }}>
                    <Text style={{ ...paragraph, margin: 0 }}>"{notePreview}"</Text>
                </Section>
                <Text style={paragraph}>
                    Please log in to your dashboard to view the full details and respond if necessary.
                </Text>

                <Button style={button} href={actionUrl}>
                    View Order Details
                </Button>
                
                <Hr style={hr} />
                
                <Text style={footer}>
                     {resellerName || 'My Accountant'}
                </Text>
            </Section>
            </Container>
        </Body>
        </Html>
    );
}

export default NewNoteNotificationEmail;
