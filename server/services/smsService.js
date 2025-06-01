import twilio from 'twilio';

// Validate environment variables on startup
const requiredEnvVars = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'];
requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
        console.error(`Missing required environment variable: ${varName}`);
        process.exit(1);
    }
});

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;


console.log('Twilio Config Check:', {
    accountSid: accountSid ? 'Present' : 'Missing',
    authToken: authToken ? 'Present' : 'Missing',
    twilioPhoneNumber: twilioPhoneNumber ? 'Present' : 'Missing',
    nodeEnv: process.env.NODE_ENV
});
// Helper function to format Kenyan phone numbers
const formatPhoneNumber = (phone) => {
    // Remove any non-digit characters
    const cleaned = phone.replace(/\D/g, '');

    // Handle Kenyan numbers starting with 0 (e.g., 0712345678 → +254712345678)
    if (cleaned.startsWith('0') && cleaned.length === 10) {
        return `+254${cleaned.substring(1)}`;
    }

    // Handle numbers already with country code but missing +
    if (cleaned.startsWith('254') && cleaned.length === 12) {
        return `+${cleaned}`;
    }

    // Return as-is if already properly formatted
    if (cleaned.startsWith('+254') && cleaned.length === 13) {
        return cleaned;
    }

    // Default case - assume it's a Kenyan number missing country code
    return `+254${cleaned}`;
};

// Enhanced SMS sending with debugging
export const sendSMS = async (to, body) => {
    const formattedTo = formatPhoneNumber(to);

    try {
        // Validate message length
        if (body.length > 1600) {
            throw new Error('Message too long (max 1600 characters)');
        }

        const message = await client.messages.create({
            body: body,
            from: twilioPhoneNumber,
            to: formattedTo,
            statusCallback: process.env.TWILIO_STATUS_CALLBACK // Optional for delivery reports
        });

        return {
            success: true,
            messageId: message.sid,
            status: message.status,
            to: formattedTo
        };
    } catch (error) {
        // Handle specific Twilio error codes
        let userMessage = 'Failed to send SMS';
        if (error.code === 21211) {
            userMessage = 'Invalid phone number';
        } else if (error.code === 21614) {
            userMessage = 'Phone number not SMS capable';
        }

        return {
            success: false,
            error: userMessage,
            code: error.code,
            details: error.message
        };
    }
};

// Enhanced booking confirmation with debugging
export const sendBookingConfirmation = async (order) => {
    try {
        // Message for sender
        const senderMessage = `Dear ${order.customer}, your courier (#${order.id}) from ${order.pickupLocation} to ${order.destination} has been booked. Recipient: ${order.recipientName} (${order.recipientPhone}). Status: ${order.status}. Thank you for choosing us!`;

        // Message for recipient
        const recipientMessage = `Hello ${order.recipientName}, a package (#${order.id}) from ${order.customer} (${order.phone}) is on its way to you at ${order.destination}. Current status: ${order.status}.`;

        console.log('Attempting to send booking confirmation SMS');

        const senderResult = await sendSMS(order.phone, senderMessage);
        const recipientResult = await sendSMS(order.recipientPhone, recipientMessage);

        console.log('Booking confirmation SMS results:', {
            senderResult,
            recipientResult
        });

        return {
            senderSuccess: senderResult.success,
            recipientSuccess: recipientResult.success
        };
    } catch (error) {
        console.error('Error in sendBookingConfirmation:', error);
        throw error;
    }
};

// Enhanced status update with debugging
export const sendStatusUpdate = async (order) => {
    try {
        // Message for sender
        const senderMessage = `Update for courier #${order.id}: Your package to ${order.recipientName} is now "${order.status}".`;

        // Message for recipient
        const recipientMessage = `Update for package #${order.id} from ${order.customer}: Status changed to "${order.status}".`;

        console.log('Attempting to send status update SMS');

        const senderResult = await sendSMS(order.phone, senderMessage);
        const recipientResult = await sendSMS(order.recipientPhone, recipientMessage);

        console.log('Status update SMS results:', {
            senderResult,
            recipientResult
        });

        return {
            senderSuccess: senderResult.success,
            recipientSuccess: recipientResult.success
        };
    } catch (error) {
        console.error('Error in sendStatusUpdate:', error);
        throw error;
    }
};