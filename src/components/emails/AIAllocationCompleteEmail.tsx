
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

interface AIAllocationCompleteEmailProps {
  clientName: string;
  totalProcessed: number;
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

export const AIAllocationCompleteEmail = ({ clientName, totalProcessed }: AIAllocationCompleteEmailProps) => {
    const previewText = `AI Allocation Complete for ${clientName}`;

    return (
        <Html>
        <Head />
        <Preview>{previewText}</Preview>
        <Body style={main}>
            <Container style={container}>
            <Section style={box}>
                <Heading style={heading}>AI Allocation Complete</Heading>
                <Text style={paragraph}>
                    The AI allocation process for <strong>{clientName}</strong> has finished.
                </Text>
                <Text style={paragraph}>
                    A total of <strong>{totalProcessed}</strong> transactions have been processed and are now ready for your review in the AI Workflow tab.
                </Text>
                
                <Button style={button} href={`${process.env.NEXT_PUBLIC_APP_URL}/admin/ai-accountant`}>
                    Go to AI Accountant
                </Button>

                <Hr style={hr} />
                
                <Text style={footer}>
                    This is an automated notification.
                </Text>
            </Section>
            </Container>
        </Body>
        </Html>
    );
}

export default AIAllocationCompleteEmail;
