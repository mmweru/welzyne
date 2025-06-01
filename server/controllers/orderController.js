import Order from '../models/orderModel.js';
import { broadcast } from '../server.js';
import { sendBookingConfirmation, sendStatusUpdate } from '../services/smsService.js';


// Create a new order
export const createOrder = async (req, res) => {
  try {
    const orderData = req.body;

    // Validate required fields
    if (!orderData.id || !orderData.phone || !orderData.recipientPhone) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Create new order
    const newOrder = new Order(orderData);
    const savedOrder = await newOrder.save();

    // Send SMS notifications
    try {
      const smsResult = await sendBookingConfirmation(savedOrder.toObject());

      await Order.findOneAndUpdate(
        { id: savedOrder.id },
        {
          $push: {
            smsNotifications: {
              type: 'booking',
              success: smsResult.senderSuccess && smsResult.recipientSuccess,
              senderStatus: smsResult.senderSuccess ? 'success' : 'failed',
              recipientStatus: smsResult.recipientSuccess ? 'success' : 'failed',
              timestamp: new Date()
            }
          }
        }
      );
    } catch (smsError) {
      console.error('SMS sending failed:', smsError);
    }

    broadcast({
      type: 'NEW_ORDER',
      order: savedOrder,
    });

    res.status(201).json(savedOrder);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



// Get all orders
export const getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find({}).sort({ createdAt: -1 });
        res.status(200).json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get orders by email
export const getOrdersByEmail = async (req, res) => {
    try {
        const { email } = req.params;
        const orders = await Order.find({ email }).sort({ createdAt: -1 });
        res.status(200).json(orders);
    } catch (error) {
        console.error('Error fetching orders by email:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get order by ID
export const getOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findOne({ id });
        
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
        res.status(200).json(order);
    } catch (error) {
        console.error('Error fetching order by ID:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
// Delete order
export const deleteOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedOrder = await Order.findOneAndDelete({ id });
        
        if (!deletedOrder) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
        // Broadcast order deletion event
        broadcast({
            type: 'ORDER_DELETED',
            orderId: id
        });
        
        res.status(200).json({ message: 'Order deleted successfully' });
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

export const logSMSNotification = async (orderId, notificationData) => {
  try {
    await Order.findOneAndUpdate(
      { id: orderId },
      { $push: { smsNotifications: notificationData } },
      { new: true }
    );
  } catch (error) {
    console.error('Error logging SMS notification:', error);
  }
};


// In controllers/orderController.js

export const updateOrderPayment = async (req, res) => {
    try {
      const { id } = req.params;
      const { paymentConfirmed, paymentStatus, mpesaConfirmationMessage } = req.body;
      
      const updatedOrder = await Order.findByIdAndUpdate(
        id,
        { 
          paymentConfirmed, 
          paymentStatus,
          mpesaConfirmationMessage,
          paymentVerificationDate: paymentConfirmed ? new Date() : null,
          paymentVerifiedBy: paymentConfirmed ? req.user.id : null
        },
        { new: true }
      );
      
      if (!updatedOrder) {
        return res.status(404).json({ message: 'Order not found' });
      }
      
      // If payment is now confirmed, send email notification
      if (paymentConfirmed && updateOrder.email) {
        try {
          const emailParams = {
            parcelNumber: updatedOrder.id,
            userName: updatedOrder.customer,
            userEmail: updatedOrder.email,
            payment: 'Confirmed (Manual M-Pesa Verification)',
            mpesa: updatedOrder.mpesaNumber,
            price: updatedOrder.amount,
            pickup: updatedOrder.pickupLocation,
            delivery: updatedOrder.destination,
            details: updatedOrder.packageDetails,
            type: updatedOrder.courierType,
            wholeBooking: updatedOrder.wholeBooking ? 'Yes' : 'No'
          };
          
          await emailjs.send('service_dxo1qa8', 'template_ha6frtq', emailParams);
        } catch (emailError) {
          console.error('Failed to send confirmation email:', emailError);
          // Continue with the response even if email fails
        }
      }
      
      res.status(200).json(updatedOrder);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  };
// Update order status
export const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        if (!status) {
            return res.status(400).json({ message: 'Status is required' });
        }
        
      const updatedOrder = await Order.findOneAndUpdate(
        { id },
        { status },
        { new: true }
      );

      // Send and track SMS
      try {
        const smsResult = await sendStatusUpdate(updatedOrder.toObject());

        await logSMSNotification(id, {
          type: 'status_update',
          success: smsResult.senderSuccess && smsResult.recipientSuccess,
          messageId: `${smsResult.senderResult?.messageId || 'none'}|${smsResult.recipientResult?.messageId || 'none'}`,
          ...(!smsResult.senderSuccess && {
            error: smsResult.senderResult?.error,
            errorCode: smsResult.senderResult?.code
          }),
          ...(!smsResult.recipientSuccess && {
            error: smsResult.recipientResult?.error,
            errorCode: smsResult.recipientResult?.code
          })
        });
      } catch (smsError) {
        console.error('SMS sending error:', smsError);
        await logSMSNotification(id, {
          type: 'status_update',
          success: false,
          error: smsError.message
        });
      }

        
        if (!updatedOrder) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
        // Broadcast order update event
        broadcast({
            type: 'ORDER_UPDATED',
            order: updatedOrder
        });
        
        res.status(200).json(updatedOrder);
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};