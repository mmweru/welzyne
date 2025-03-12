// In models/Order.js

import mongoose from 'mongoose';

// In models/Order.js
const orderSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
  },
  customer: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  recipientName: {
    type: String,
    required: true,
  },
  recipientPhone: {
    type: String,
    required: true,
  },
  destination: {
    type: String,
    required: true,
  },
  pickupLocation: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['Order Placed', 'Processing', 'In Transit', 'Out for Delivery', 'Delivered'],
    default: 'Order Placed',
  },
  date: {
    type: Date,
    default: Date.now,
  },
  amount: {
    type: Number,
    required: true,
  },
  packageDetails: {
    type: String,
    required: true,
  },
  courierType: {
    type: String,
    enum: ['standard', 'express', 'same-day'],
    default: 'standard',
  },
  wholeBooking: {
    type: Boolean,
    default: false,
  },
  paymentMode: {
    type: String,
    enum: ['mpesa', 'cash'],
    default: 'mpesa',
  },
  mpesaNumber: {
    type: String,
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Completed'],
    default: 'Pending',
  },
  paymentConfirmed: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});


const Order = mongoose.model('Order', orderSchema);

export default Order;