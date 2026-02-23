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

interface AllocationQueryEmailProps {
  clientName: string;
  unallocatedCount: number;
  chatUrl: string;
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

export const AllocationQueryEmail = ({ clientName, unallocatedCount, chatUrl }: AllocationQueryEmailProps) => {
    const previewText = `Clarification needed for ${unallocatedCount} transactions`;

    return (
        <Html>
        <Head />
        <Preview>{previewText}</Preview>
        <Body style={main}>
            <Container style={container}>
            <Section style={box}>
                <Heading style={heading}>Transaction Clarification Required</Heading>
                <Text style={paragraph}>
                    Hi {clientName.split(' ')[0]},
                </Text>
                <Text style={paragraph}>
                    We are currently processing your books and noticed <strong>{unallocatedCount}</strong> transactions that we couldn't automatically identify.
                </Text>
                <Text style={paragraph}>
                    To ensure your records are accurate, could you please take a moment to chat with our AI assistant? You just need to explain what these payments were for in plain English.
                </Text>
                
                <Button style={button} href={chatUrl}>
                    Chat with Khai (AI Assistant)
                </Button>

                <Hr style={hr} />
                
                <Text style={paragraph}>
                    Regards,
                    <br />
                    The My Accountant Team
                </Text>
                
                <Text style={footer}>
                    This is a secure link. You will be asked to log in to your dashboard to access the chat.
                </Text>
            </Section>
            </Container>
        </Body>
        </Html>
    );
}

export default AllocationQueryEmail;
