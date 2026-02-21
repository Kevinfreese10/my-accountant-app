
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

interface AIAnalysisCompleteEmailProps {
  clientName: string;
  totalProcessed: number;
  dashboardUrl: string;
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

export const AIAnalysisCompleteEmail = ({ clientName, totalProcessed, dashboardUrl }: AIAnalysisCompleteEmailProps) => {
    const previewText = `AI Analysis Complete for ${clientName}`;

    return (
        <Html>
        <Head />
        <Preview>{previewText}</Preview>
        <Body style={main}>
            <Container style={container}>
            <Section style={box}>
                <Heading style={heading}>AI Analysis Complete</Heading>
                <Text style={paragraph}>
                    The background AI analysis for <strong>{clientName}</strong> has finished.
                </Text>
                <Text style={paragraph}>
                    A total of <strong>{totalProcessed}</strong> transactions have been automatically analyzed and grouped. You can now review these suggestions in the <strong>AI Workflow</strong> tab.
                </Text>
                
                <Button style={button} href={dashboardUrl}>
                    Review Transactions
                </Button>

                <Hr style={hr} />
                
                <Text style={paragraph}>
                    Regards,
                    <br />
                    The My Accountant Team
                </Text>
                
                <Text style={footer}>
                    This is an automated notification from the My Accountant AI Engine.
                </Text>
            </Section>
            </Container>
        </Body>
        </Html>
    );
}

export default AIAnalysisCompleteEmail;
