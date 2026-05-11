
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

interface AIAccountantInviteEmailProps {
  name: string;
  email: string;
  password_do_not_expose: string;
  clientName: string;
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

export const AIAccountantInviteEmail = ({ name, email, password: password_do_not_expose, clientName, loginUrl }: { name: string; email: string; password?: string; clientName: string; loginUrl: string; }) => {
    const previewText = `You've been invited to ${clientName}`;

    return (
        <Html>
        <Head />
        <Preview>{previewText}</Preview>
        <Body style={main}>
            <Container style={container}>
            <Section style={box}>
                <Heading style={heading}>You're Invited!</Heading>
                <Text style={paragraph}>
                    Hi {name},
                </Text>
                <Text style={paragraph}>
                    You have been invited to collaborate on the AI Accountant profile for <strong>{clientName}</strong>. An account has been created for you.
                </Text>
                <Text style={paragraph}>
                    You can log in with the following credentials:
                </Text>
                <Section style={{ border: '1px solid #e6ebf1', borderRadius: '5px', padding: '20px', backgroundColor: '#fafafa', marginTop: '20px' }}>
                    <Text style={{ ...paragraph, margin: 0 }}><strong>Email:</strong> {email}</Text>
                    <Text style={{ ...paragraph, margin: 0 }}><strong>Password:</strong> {password_do_not_expose}</Text>
                </Section>
                <Text style={paragraph}>
                    It is recommended to change your password after your first login.
                </Text>

                <Button style={button} href={loginUrl}>
                    Login to Your Account
                </Button>
                
                <Hr style={hr} />
                
                <Text style={footer}>
                     My Accountant | <a href="mailto:info@myacc.co.za" style={anchor}>info@myacc.co.za</a> | Ground Floor, Waterstone Building, Stonemill Office Park, 300 Acacia Road, Darrenwood, Johannesburg, 2195
                </Text>
            </Section>
            </Container>
        </Body>
        </Html>
    );
}

export default AIAccountantInviteEmail;
