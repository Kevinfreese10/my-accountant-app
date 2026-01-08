
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
  Link,
} from '@react-email/components';
import * as React from 'react';

interface PartnerWelcomeEmailProps {
  partnerName: string;
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
  color: '#333'
}

export const PartnerWelcomeEmail = ({ partnerName, dashboardUrl }: PartnerWelcomeEmailProps) => {
    const previewText = `Welcome to the My Accountant Partner Program!`;

    return (
        <Html>
        <Head />
        <Preview>{previewText}</Preview>
        <Body style={main}>
            <Container style={container}>
            <Section style={box}>
                <Heading style={heading}>Welcome Aboard, {partnerName}!</Heading>
                <Text style={paragraph}>
                    Thank you for joining the My Accountant Partner Program. We're excited to have you with us.
                </Text>
                <Text style={paragraph}>
                    Your partner account has been successfully created. You can now access your dashboard to start creating orders for your clients, track progress, and access our partner resources.
                </Text>
                
                <Button style={button} href={dashboardUrl}>
                    Go to My Dashboard
                </Button>

                <Hr style={hr} />
                
                 <Text style={paragraph}>
                    If you have any questions, please don't hesitate to reach out to our partner support team.
                </Text>

                <Text style={paragraph}>
                    Regards,
                    <br />
                    The My Accountant Team
                </Text>
                
                <Text style={footer}>
                     My Accountant | <a href="mailto:info@myacc.co.za" style={anchor}>info@myacc.co.za</a> | 369 Oak Avenue, Ferndale, Randburg
                </Text>
            </Section>
            </Container>
        </Body>
        </Html>
    );
}

export default PartnerWelcomeEmail;
