import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

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

    console.log('Attempting to send SMS:', {
        to: formattedTo,
        body: body
    });

    try {
        const message = await client.messages.create({
            body: body,
            from: twilioPhoneNumber,
            to: formattedTo
        });

        console.log('SMS sent successfully:', {
            sid: message.sid,
            status: message.status,
            to: formattedTo,
            dateCreated: message.dateCreated
        });

        return {
            success: true,
            messageId: message.sid,
            status: message.status
        };
    } catch (error) {
        console.error('Error sending SMS:', {
            error: error.message,
            code: error.code,
            to: formattedTo,
            originalTo: to,
            timestamp: new Date().toISOString()
        });

        return {
            success: false,
            error: error.message,
            code: error.code
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