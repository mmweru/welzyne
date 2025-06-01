import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Package, Truck, Clock, Settings, User, ChevronRight, Plus, Edit, Trash, Mail, Phone, X } from './CustomIcons';
import emailjs from '@emailjs/browser';
import { useAuth } from './context/AuthContext';
import './AdminDashboard.css';
import { sendBookingConfirmation, sendStatusUpdate } from './utils/smsService';

const api = axios.create({
  baseURL: process.env.NODE_ENV === 'production' 
    ? '/api' 
    : import.meta.env.VITE_API_URL,
  withCredentials: true
});

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showAddService, setShowAddService] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showCourierForm, setShowCourierForm] = useState(false);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user: currentUser } = useAuth();
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Existing state variables
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [courierPrice, setCourierPrice] = useState('');
  const [parcelNumber, setParcelNumber] = useState('');
  const [courierType, setCourierType] = useState('standard');
  const [pickupLocation, setPickupLocation] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  
  // New state variables
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [wholeBooking, setWholeBooking] = useState(false);
  const [orders, setOrders] = useState([]);
  const [editingOrder, setEditingOrder] = useState(null);
  const [showOrderStatusModal, setShowOrderStatusModal] = useState(false);
  const [paymentMode, setPaymentMode] = useState('mpesa');
  const [userPhone, setUserPhone] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');

  // Sample data for services
  const [services] = useState([
    { id: 1, name: 'Standard Delivery', price: '500', duration: '2-3 days' },
    { id: 2, name: 'Express Delivery', price: '1000', duration: '24 hours' }
  ]);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    try {
      const response = await api.get('/users', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      setUsers(response.data);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, []);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    try {
      const response = await api.get('/orders', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      setOrders(response.data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  // Initialize WebSocket connection and email.js
  useEffect(() => {
    fetchUsers();
    fetchOrders();
    emailjs.init('WdN8teWHYoFcWl3S3');
    
    const ws = new WebSocket('ws://localhost:7001');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'NEW_USER':
          setUsers(prevUsers => [...prevUsers, data.user]);
          break;
        case 'USER_UPDATED':
          setUsers(prevUsers => 
            prevUsers.map(user => 
              user._id === data.user._id ? data.user : user
            )
          );
          break;
        case 'USER_DELETED':
          setUsers(prevUsers => 
            prevUsers.filter(user => user._id !== data.userId)
          );
          break;
        case 'NEW_ORDER':
          setOrders(prevOrders => [...prevOrders, data.order]);
          break;
        case 'ORDER_UPDATED':
          setOrders(prevOrders => 
            prevOrders.map(order => 
              order.id === data.order.id ? data.order : order
            )
          );
          break;
        case 'ORDER_DELETED':
          setOrders(prevOrders => 
            prevOrders.filter(order => order.id !== data.orderId)
          );
          break;
        default:
          break;
      }
    };

    return () => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.close();
      }
    };
  }, [fetchUsers, fetchOrders]);

  // Handle user status toggle
  const handleStatusToggle = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    try {
      await api.patch(`/users/${userId}/status`, {
        status: newStatus
      }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
    } catch (err) {
      setError('Failed to update user status');
    }
  };

  // Handle user deletion
  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await api.delete(`/users/${userId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
      } catch (err) {
        setError('Failed to delete user');
      }
    }
  };

  // Handle order deletion
  const handleDeleteOrder = async (orderId) => {
    if (window.confirm('Are you sure you want to delete this order?')) {
      try {
        await api.delete(`/orders/${orderId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });      
        // Remove from local state
        setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));
      } catch (err) {
        setError('Failed to delete order');
      }
    }
  };

  const handleUpdateOrderStatus = async () => {
    if (!editingOrder || !editingOrder.newStatus) {
      console.error('No order or status selected');
      return;
    }

    try {
      setLoading(true);
      const response = await api.patch(`/orders/${editingOrder.id}/status`, {
        status: editingOrder.newStatus
      }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        // Update local state with new order status
        const updatedOrders = orders.map(order =>
          order.id === editingOrder.id
            ? { ...order, status: editingOrder.newStatus }
            : order
        );
        setOrders(updatedOrders);

        // Find the updated order
        const updatedOrder = updatedOrders.find(o => o.id === editingOrder.id);

        // Send SMS notification
        if (updatedOrder) {
          await sendStatusUpdate(updatedOrder);
        }

        setShowSuccessPopup(true);
        setSuccessMessage('Order status updated successfully!');
        setShowOrderStatusModal(false);
        setEditingOrder(null);
      } else {
        throw new Error(response.data.message || 'Failed to update order status');
      }
    } catch (error) {
      console.error('Failed to update order status:', error);
      alert(`Failed to update order status: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };
  // Generate parcel number
  const generateParcelNumber = () => {
    const carrierCode = 'WELZYNE'; // First Digits: Carrier
    const shipmentDetails = courierType.toUpperCase(); // Middle Section: Shipment Details
    const uniqueId = Math.floor(1000 + Math.random() * 9000); // Last Digits: Unique Package Identifier
    return `${carrierCode}-${shipmentDetails}-${uniqueId}`;
  };

  const handleCourierSubmit = async (e) => {
    e.preventDefault();
  
    // Validate key fields
    if (
      !userName ||
      !userPhone ||
      !recipientName ||
      !recipientPhone ||
      !pickupLocation ||
      !deliveryLocation ||
      !courierPrice
    ) {
      alert('Please fill in all required fields');
      return;
    }
  
    try {
      // Generate parcel number
      const generatedParcelNumber = generateParcelNumber();
      setParcelNumber(generatedParcelNumber);
  
      // Get form data
      const packageDetails = e.target['package-details'].value;
      const mpesaNumber = paymentMode === 'mpesa' ? e.target['mpesa-number'].value : '';
  
      // Create order data object
      const orderData = {
        id: generatedParcelNumber,
        customer: userName,
        phone: userPhone, // Sender's phone number
        recipientName: recipientName,
        recipientPhone: recipientPhone,
        status: 'Order Placed',
        date: new Date().toISOString().split('T')[0],
        amount: courierPrice,
        destination: deliveryLocation,
        pickupLocation: pickupLocation,
        courierType: courierType,
        paymentMode: paymentMode,
        mpesaNumber: mpesaNumber,
        packageDetails: packageDetails,
        wholeBooking: wholeBooking,
        paymentStatus: 'Pending',
      };
  
      console.log('Sending order data:', orderData); // Debug log
  
      // Send to server
      const response = await api.post('/orders', orderData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });
  
      // Update local state if server update was successful
      if (response.status === 201) {
        setOrders((prevOrders) => [...prevOrders, response.data]);
        setSuccessMessage(`Booking Successful! Your Parcel Number is: ${generatedParcelNumber}`);
        setShowSuccessPopup(true);

        // Send email confirmation
        const emailParams = {
          pickup: pickupLocation,
          delivery: deliveryLocation,
          details: packageDetails,
          type: courierType,
          payment: paymentMode === 'mpesa' ? 'Pending (M-Pesa)' : 'Pending (Cash)',
          price: courierPrice,
          parcelNumber: generatedParcelNumber,
          userName: userName,
          userPhone: userPhone,
          recipientName: recipientName,
          recipientPhone: recipientPhone,
          wholeBooking: wholeBooking ? 'Yes' : 'No',
        };
  
        await emailjs.send('service_dxo1qa8', 'template_ha6frtq', emailParams);
  
        // Send SMS notifications
        await sendBookingConfirmation(orderData);

        // Reset form and close modal
        setShowCourierForm(false);
        resetFormFields();
      }
    } catch (error) {
      console.error('Booking Error:', error);
  
      // Provide more detailed error information
      if (error.response) {
        const errorMsg = error.response.data.message || error.response.statusText;
        alert(`Failed to book courier: ${errorMsg}`);
        console.log('Error response:', error.response.data); // More detailed logging
      } else if (error.request) {
        alert('Failed to book courier: No response from server. Please check your connection.');
      } else {
        alert(`Failed to book courier: ${error.message}`);
      }
    }
  };

  const resetFormFields = () => {
    setPaymentConfirmed(false);
    setCourierPrice('');
    setParcelNumber('');
    setUserName('');
    setUserEmail('');
    setUserPhone('');
    setRecipientName('');
    setRecipientPhone('');
    setPickupLocation('');
    setDeliveryLocation('');
    setCourierType('standard');
    setWholeBooking(false);
    setPaymentMode('mpesa');
  };

  const renderUsersSection = () => (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold mb-6">Manage Users</h2>
      {loading ? (
        <div className="text-center text-white">Loading users...</div>
      ) : error ? (
        <div className="text-center text-red-500">{error}</div>
      ) : (
        <div className="space-y-4">
          {users.map((user) => (
            <div
              key={user._id}
              className="bg-white/5 p-4 rounded-lg flex items-center justify-between hover:bg-white/10 transition-all duration-300"
            >
              <div>
                <h3 className="font-bold">{user.username}</h3>
                <div className="flex items-center text-blue-200">
                  <Phone size={16} className="mr-2" /> 
                  {user.phone}
                </div>
                <p className="text-gray-400">{user.email}</p>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => handleStatusToggle(user._id, user.status)}
                  className={`px-3 py-1 rounded-full text-sm ${
                    user.status === 'Active'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {user.status}
                </button>
                <button onClick={() => setSelectedUser(user)}>
                  <Edit size={20} className="text-blue-400 hover:text-blue-300" />
                </button>
                <button onClick={() => handleDeleteUser(user._id)}>
                  <Trash size={20} className="text-red-400 hover:text-red-300" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderOrderStatusModal = () => (
    showOrderStatusModal && editingOrder && (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md animate-fadeIn modal-content">
          <h2 className="text-xl font-bold text-white mb-4">Update Order Status</h2>
          <div className="space-y-4">
            <p className="text-blue-200">Order ID: {editingOrder.id}</p>
            <div>
              <label className="block text-gray-300 mb-2">
                Current Status: {editingOrder.currentStatus}
              </label>
              <select
                value={editingOrder.newStatus}
                onChange={(e) => setEditingOrder({
                  ...editingOrder,
                  newStatus: e.target.value
                })}
                className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring focus:ring-blue-500"
                disabled={loading}
              >
                <option value="">Select new status</option>
                <option value="Order Placed">Order Placed</option>
                <option value="Processing">Processing</option>
                <option value="In Transit">In Transit</option>
                <option value="Out for Delivery">Out for Delivery</option>
                <option value="Delivered">Delivered</option>
              </select>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowOrderStatusModal(false);
                  setEditingOrder(null);
                }}
                className="px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-700 transition-colors duration-300"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateOrderStatus}
                className={`px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-white transition-colors duration-300 ${
                  loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={loading || !editingOrder.newStatus}
              >
                {loading ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  );

  const renderOrdersSection = () => (
    <section className="bg-gray-900/60 rounded-xl p-6 backdrop-blur">
      <h2 className="text-2xl font-bold mb-6">Manage Orders</h2>
  
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="p-3 text-left">ID</th>
              <th className="p-3 text-left">Sender</th>
              <th className="p-3 text-left">Recipient</th>
              <th className="p-3 text-left">Destination</th>
              <th className="p-3 text-left">Pickup</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Amount</th>
              <th className="p-3 text-left">Payment</th>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="p-3">
                  <span className="font-mono text-sm">{order.id}</span>
                </td>
                <td className="p-3">
                  <div>{order.customer}</div>
                  <div className="text-sm text-blue-300">{order.phone}</div>
                </td>
                <td className="p-3">
                  <div>{order.recipientName}</div>
                  <div className="text-sm text-blue-300">{order.recipientPhone}</div>
                </td>
                <td className="p-3">
                  {order.destination}
                </td>
                <td className="p-3">
                  From: {order.pickupLocation}
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    order.status === 'Delivered' ? 'bg-green-500/20 text-green-400' :
                    order.status === 'In Transit' ? 'bg-blue-500/20 text-blue-400' :
                    order.status === 'Order Placed' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {order.status}
                  </span>
                </td>
                <td className="p-3">
                  KES {order.amount}
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    order.paymentConfirmed ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {order.paymentConfirmed ? 'Paid' : 'Pending'}
                  </span>
                </td>
                <td className="p-3">
                  {new Date(order.date).toLocaleDateString()}
                </td>
                <td className="p-3 space-y-2">
                  <button
                    onClick={() => {
                      setEditingOrder({ 
                        id: order.id, 
                        currentStatus: order.status,
                        newStatus: order.status
                      });
                      setShowOrderStatusModal(true);
                    }}
                    className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors"
                  >
                    Update Status
                  </button>
                  <button
                    onClick={() => handleDeleteOrder(order.id)}
                    className="px-3 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  return (
    <div className="min-h-screen p-6 font-['Jacques_Francois']">
      {/* Grid Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-blue-900/90 to-darkblue-800/80" />
        <div className="absolute inset-0 opacity-10">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-silver/50 to-transparent transform"
              style={{ top: `${i * 5}vh`, animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 text-white animate-fadeIn">
          <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-blue-200">Manage your courier service operations</p>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white/10 backdrop-blur-lg rounded-lg p-2 flex space-x-2 nav-responsive">
          {['dashboard', 'users', 'orders', 'services'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 rounded-lg transition-all duration-300 ${
                activeTab === tab
                  ? 'bg-blue-500 text-white'
                  : 'text-blue-200 hover:bg-white/5'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Main Content Area */}
        <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 text-white min-h-[600px] animate-fadeIn">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid-container">
                <div className="bg-white/5 p-6 rounded-lg">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold">Total Users</h3>
                    <User size={24} className="text-blue-400" />
                  </div>
                  <p className="text-3xl font-bold mt-4">{users.length}</p>
                </div>
                <div className="bg-white/5 p-6 rounded-lg">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold">Active Orders</h3>
                    <Package size={24} className="text-green-400" />
                  </div>
                  <p className="text-3xl font-bold mt-4">{orders.length}</p>
                </div>
                <div className="bg-white/5 p-6 rounded-lg">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold">Services</h3>
                    <Truck size={24} className="text-yellow-400" />
                  </div>
                  <p className="text-3xl font-bold mt-4">{services.length}</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowCourierForm(true);
                  setShowSuccessPopup(false);
                }}
                className="w-full bg-blue-500 hover:bg-blue-600 p-4 rounded-lg font-bold transition-colors duration-300"
              >
                Book a Courier
              </button>
            </div>
          )}

          {activeTab === 'users' && renderUsersSection()}
          {activeTab === 'orders' && renderOrdersSection()}

          {activeTab === 'services' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h2 className="text-xl sm:text-2xl font-bold">Manage Services</h2>
                <button
                  onClick={() => setShowAddService(true)}
                  className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg flex items-center space-x-2 text-sm sm:text-base"
                >
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Add Service</span>
                </button>
              </div>

              <div className="grid gap-4">
                {services.map((service) => (
                  <div key={service.id} className="bg-white/5 hover:bg-white/10 p-4 rounded-lg">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h3 className="font-bold text-sm sm:text-base">{service.name}</h3>
                        <p className="text-blue-200 text-xs sm:text-sm">{service.duration}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="font-bold text-sm sm:text-base">KES {service.price}</p>
                        <div className="flex gap-2">
                          <button>
                            <Edit className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 hover:text-blue-300" />
                          </button>
                          <button>
                            <Trash className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 hover:text-red-300" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Courier Booking Modal */}
      {showCourierForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 overflow-hidden">
          <div className="bg-gray-800 p-8 rounded-lg w-full max-w-4xl m-4 max-h-[90vh] flex flex-col animate-fadeIn modal-content">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Book a Courier</h2>
              <button 
                onClick={() => {
                  setShowCourierForm(false);
                  resetFormFields();
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="overflow-y-auto flex-grow pr-2">
              <form onSubmit={handleCourierSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-gray-300 mb-2">Sender's Name</label>
                    <input
                      type="text"
                      name="user-name"
                      className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring focus:ring-blue-500"
                      required
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-300 mb-2">Sender's Phone</label>
                    <input
                      type="tel"
                      name="user-phone"
                      className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring focus:ring-blue-500"
                      required
                      value={userPhone}
                      onChange={(e) => setUserPhone(e.target.value)}
                      placeholder="0712345678"
                      pattern="^(07|01)\d{8}$"
                      title="Please enter a valid 10-digit Kenyan phone number starting with 07 or 01"
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-gray-300 mb-2">Recipient's Full Name</label>
                    <input
                      type="text"
                      name="recipient-name"
                      className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring focus:ring-blue-500"
                      required
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-300 mb-2">Recipient's Phone</label>
                    <input
                      type="tel"
                      name="recipient-phone"
                      className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring focus:ring-blue-500"
                      required
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      placeholder="0712345678"
                      pattern="^(07|01)\d{8}$"
                      title="Please enter a valid 10-digit Kenyan phone number starting with 07 or 01"
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-gray-300 mb-2">Pickup Location</label>
                    <input
                      type="text"
                      name="pickup-location"
                      className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring focus:ring-blue-500"
                      required
                      value={pickupLocation}
                      onChange={(e) => setPickupLocation(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-300 mb-2">Delivery Location</label>
                    <input
                      type="text"
                      name="delivery-location"
                      className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring focus:ring-blue-500"
                      required
                      value={deliveryLocation}
                      onChange={(e) => setDeliveryLocation(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-300 mb-2">Package Details</label>
                  <textarea
                    name="package-details"
                    rows="4"
                    className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring focus:ring-blue-500"
                    required
                  ></textarea>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-gray-300 mb-2">Courier Type</label>
                    <select
                      name="courier-type"
                      className="w-full p-3 rounded-lg bg-gray-700 text-black border border-gray-600 focus:outline-none focus:ring focus:ring-blue-500"
                      required
                      value={courierType}
                      onChange={(e) => setCourierType(e.target.value)}
                    >
                      <option value="standard">Standard</option>
                      <option value="express">Express</option>
                      <option value="same-day">Same-day</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-300 mb-2">Payment Mode</label>
                    <select
                      name="payment-mode"
                      className="w-full p-3 rounded-lg bg-gray-700 text-black border border-gray-600 focus:outline-none focus:ring focus:ring-blue-500"
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      required
                    >
                      <option value="mpesa">M-Pesa</option>
                      <option value="cash">Cash</option>
                    </select>
                  </div>
                  {paymentMode === 'mpesa' && (
                    <div>
                      <label className="block text-gray-300 mb-2">M-Pesa Number</label>
                      <input
                        type="text"
                        name="mpesa-number"
                        className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring focus:ring-blue-500"
                        placeholder="0712345678"
                        pattern="^(07|01)[0-9]{8}$"
                        title="Please enter a valid 10-digit M-Pesa number starting with 07 or 01"
                        required
                      />
                    </div>
                  )}
                </div>

                {/* Whole Truck Booking Option */}
                <div className="flex items-center space-x-4 mb-4">
                  <input
                    type="checkbox"
                    id="whole-truck"
                    checked={wholeBooking}
                    onChange={(e) => setWholeBooking(e.target.checked)}
                    className="w-5 h-5 rounded-lg"
                  />
                  <label htmlFor="whole-truck" className="text-gray-300">
                    Book entire truck (for large shipments)
                  </label>
                </div>

                {/* Price Input */}
                <div>
                  <label className="block text-gray-300 mb-2">Price (KES)</label>
                  <input
                    type="number"
                    name="courier-price"
                    className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring focus:ring-blue-500"
                    required
                    value={courierPrice}
                    onChange={(e) => setCourierPrice(e.target.value)}
                  />
                </div>

                {/* Payment Confirmation */}
                <div className="flex items-center space-x-4">
                  <input
                    type="checkbox"
                    id="confirm-payment"
                    checked={paymentConfirmed}
                    onChange={(e) => setPaymentConfirmed(e.target.checked)}
                    className="w-5 h-5 rounded-lg"
                  />
                  <label htmlFor="confirm-payment" className="text-gray-300">
                    I confirm that the payment has been made.
                  </label>
                </div>

                {/* Parcel Number Display */}
                {parcelNumber && (
                  <div className="bg-white/5 p-4 rounded-lg">
                    <p className="text-gray-300">Your Parcel Number: <span className="font-bold">{parcelNumber}</span></p>
                  </div>
                )}

                <div className="flex justify-end space-x-4 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCourierForm(false);
                      resetFormFields();
                    }}
                    className="px-6 py-3 rounded-lg text-gray-300 hover:bg-gray-700 transition-colors duration-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg text-white transition-colors duration-300"
                  >
                    Book Courier
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Order Status Update Modal */}
      {renderOrderStatusModal()}

      {/* Success Popup */}
      {showSuccessPopup && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4 animate-fadeIn">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-green-400">Success!</h3>
              <button 
                onClick={() => setShowSuccessPopup(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-gray-200 mb-6">{successMessage}</p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowSuccessPopup(false)}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-white transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;