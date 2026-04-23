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

interface TaskCompletedEmailProps {
  creatorName: string;
  taskTitle: string;
  completedBy: string;
  taskUrl: string;
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


export const TaskCompletedEmail = ({ creatorName, taskTitle, completedBy, taskUrl }: TaskCompletedEmailProps) => {
    const previewText = `Task Completed: ${taskTitle}`;

    return (
        <Html>
        <Head />
        <Preview>{previewText}</Preview>
        <Body style={main}>
            <Container style={container}>
            <Section style={box}>
                <Heading style={heading}>Task Completed</Heading>
                <Text style={paragraph}>
                    Hi {creatorName.split(' ')[0]},
                </Text>
                <Text style={paragraph}>
                    The task "<strong>{taskTitle}</strong>" has been marked as complete by <strong>{completedBy}</strong>.
                </Text>
                
                <Button style={button} href={taskUrl}>
                    View Task on Dashboard
                </Button>

                <Hr style={hr} />
                
                <Text style={footer}>
                     My Accountant | <a href="mailto:info@myacc.co.za" style={anchor}>info@myacc.co.za</a> | Clearwater Office Park, Building 3, Millenium Road & Christiaan de Wet Road, Roodepoort
                </Text>
            </Section>
            </Container>
        </Body>
        </Html>
    );
}

export default TaskCompletedEmail;
