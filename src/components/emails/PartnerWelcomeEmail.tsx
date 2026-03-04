
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
  email: string;
  password?: string;
  loginUrl: string;
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

const credentialsBox = {
    padding: '24px',
    backgroundColor: '#f4f7ff',
    borderRadius: '8px',
    border: '1px solid #e0e7ff',
    margin: '24px 0',
}

export const PartnerWelcomeEmail = ({ partnerName, email, password, loginUrl }: PartnerWelcomeEmailProps) => {
    const previewText = `Welcome to the My Accountant Partner Program!`;

    return (
        <Html>
        <Head />
        <Preview>{previewText}</Preview>
        <Body style={main}>
            <Container style={container}>
            <Section style={box}>
                <Heading style={heading}>Welcome Aboard, {partnerName.split(' ')[0]}!</Heading>
                <Text style={paragraph}>
                    Thank you for joining the My Accountant Partner Program. We're excited to have you with us.
                </Text>
                <Text style={paragraph}>
                    Your partner account has been successfully created. You can use the credentials below to log in to your practice dashboard.
                </Text>
                
                <Section style={credentialsBox}>
                    <Text style={{ ...paragraph, margin: '0 0 8px 0' }}><strong>Email:</strong> {email}</Text>
                    <Text style={{ ...paragraph, margin: 0 }}><strong>Password:</strong> {password}</Text>
                </Section>

                <Button style={button} href={loginUrl}>
                    Login to Dashboard
                </Button>

                <Hr style={hr} />
                
                 <Text style={paragraph}>
                    If you have any questions or need technical support, please don&apos;t hesitate to reach out to <strong>Kevin Freese</strong> at <Link href="mailto:kev@thinkestry.co.za" style={anchor}>kev@thinkestry.co.za</Link>.
                </Text>

                <Text style={paragraph}>
                    Regards,
                    <br />
                    The My Accountant Team
                </Text>
                
                <Text style={footer}>
                     My Accountant | <Link href="mailto:info@myacc.co.za" style={anchor}>info@myacc.co.za</Link> | 369 Oak Avenue, Ferndale, Randburg
                </Text>
            </Section>
            </Container>
        </Body>
        </Html>
    );
}

export default PartnerWelcomeEmail;
