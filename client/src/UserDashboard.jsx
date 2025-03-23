import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Package, Truck, Clock, User, ChevronRight, Search, Camera, CheckCircle } from './CustomIcons';
import { useAuth } from './context/AuthContext';

// Create axios instance with base URL
const api = axios.create({
  baseURL: process.env.NODE_ENV === 'production' 
    ? '/api' 
    : import.meta.env.VITE_API_URL,
  withCredentials: true
});

const UserDashboard = () => {
  const { user, loading, setUser, updateProfile } = useAuth();
  const [hoveredCard, setHoveredCard] = useState(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [showTrackingResult, setShowTrackingResult] = useState(false);
  const [showProfileDetails, setShowProfileDetails] = useState(false);
  const [orders, setOrders] = useState([]);
  const [recentDeliveries, setRecentDeliveries] = useState([]);
  const [deliveryStats, setDeliveryStats] = useState([
    { title: 'Active Orders', value: '0', icon: Package, color: 'bg-blue-500' },
    { title: 'In Transit', value: '0', icon: Truck, color: 'bg-green-500' },
    { title: 'Pending', value: '0', icon: Clock, color: 'bg-yellow-500' }
  ]);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    username: user?.username || '',
    email: user?.email || '',
    phone: user?.phone || '',
    bio: user?.bio || '',
    address: user?.address || ''
  });
  const [profileError, setProfileError] = useState(null);
  const [profilePhoto, setProfilePhoto] = useState(user?.photoUrl || null);
  const [photoFile, setPhotoFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleEditProfile = () => {
    setIsEditingProfile(true);
    setProfileForm({
      username: user?.username || '',
      email: user?.email || '',
      phone: user?.phone || '',
      bio: user?.bio || '',
      address: user?.address || ''
    });
    setPhotoFile(null);
    setProfileError(null); // Reset any previous errors
  };

  const handleProfileFormChange = (e) => {
    const { name, value } = e.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoClick = () => {
    fileInputRef.current.click();
  };

  const handlePhotoChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePhoto(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setProfileError(null);

    try {
      // Create FormData object to handle file upload
      const formData = new FormData();
      
      // Add all profile form fields
      Object.keys(profileForm).forEach(key => {
        formData.append(key, profileForm[key]);
      });
      
      // Add photo if selected
      if (photoFile) {
        formData.append('profilePhoto', photoFile);
      }
      
      // Send multipart/form-data request
      const token = localStorage.getItem('token');
      const response = await api.put('/users/profile', formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data.success) {
        // Update user context with new data
        setUser(response.data.user);
        setIsEditingProfile(false);
        // Optional: Show success message
      } else {
        setProfileError(response.data.error || 'Update failed');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      setProfileError('An unexpected error occurred. Please try again.');
    }
  };

  // Fetch user's orders
  useEffect(() => {
    if (user && !loading) {
      fetchUserOrders();
      const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:7001';
      const ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (user && (
            (data.type === 'NEW_ORDER' && data.order.email === user.email) ||
            (data.type === 'ORDER_UPDATED' && data.order.email === user.email) ||
            (data.type === 'ORDER_DELETED' && orders.some(o => o.id === data.orderId))
          )) {
          fetchUserOrders();
        }
      };
      return () => {
        if (ws.readyState === 1) ws.close();
      };
    }
  }, [user, loading]);

  const fetchUserOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await api.get(`/orders/user/${user.email}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const userOrders = response.data;
      setOrders(userOrders);
      const recent = userOrders
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
        .map(order => ({
          id: order.id,
          destination: order.destination,
          status: order.status,
          date: new Date(order.date).toLocaleDateString()
        }));
      setRecentDeliveries(recent);
      const activeCount = userOrders.filter(order => order.status !== 'Delivered' && order.status !== 'Cancelled').length;
      const inTransitCount = userOrders.filter(order => order.status === 'In Transit').length;
      const pendingCount = userOrders.filter(order => order.status === 'Order Placed' || order.status === 'Processing').length;
      setDeliveryStats([
        { title: 'Active Orders', value: activeCount.toString(), icon: Package, color: 'bg-blue-500' },
        { title: 'In Transit', value: inTransitCount.toString(), icon: Truck, color: 'bg-green-500' },
        { title: 'Pending', value: pendingCount.toString(), icon: Clock, color: 'bg-yellow-500' }
      ]);
    } catch (err) {
      console.error('Failed to fetch user orders:', err);
    }
  };

  const handleTrackOrder = (e) => {
    e.preventDefault();
    setShowTrackingResult(true);
  };

  const getTrackingStatus = () => {
    const order = orders.find(o => o.id === trackingNumber);
    if (!order) return [{ status: 'Order Not Found', date: '', completed: false }];
    const baseSteps = [
      { status: 'Order Placed', date: order.date, completed: true },
      { status: 'Processing', date: '', completed: false },
      { status: 'In Transit', date: '', completed: false },
      { status: 'Out for Delivery', date: '', completed: false },
      { status: 'Delivered', date: '', completed: false }
    ];
    const statusIndex = {
      'Order Placed': 0,
      'Processing': 1,
      'In Transit': 2,
      'Out for Delivery': 3,
      'Delivered': 4
    };
    const currentIndex = statusIndex[order.status] || 0;
    return baseSteps.map((step, index) => ({
      ...step,
      completed: index <= currentIndex
    }));
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-white">Loading...</div>;

  return (
    <div className="min-h-screen p-4 md:p-6 font-['Jacques_Francois']">
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
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-silver/50 to-transparent transform"
              style={{ left: `${i * 5}vw`, animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto space-y-6">
        {/* Welcome Section */}
        <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4 md:p-6 text-white animate-fadeIn">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Welcome back, {user?.username || 'User'}</h1>
          <p className="text-blue-200">Track your deliveries and manage your orders</p>
        </div>

        {/* Track Parcel Section */}
        <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4 md:p-6 text-white">
          <h2 className="text-xl md:text-2xl font-bold mb-4">Track Your Parcel</h2>
          <form onSubmit={handleTrackOrder} className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              placeholder="Enter Tracking Number"
              className="flex-1 p-3 rounded-lg bg-white/5 text-white border border-white/20 focus:outline-none focus:ring focus:ring-blue-500"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              required
            />
            <button
              type="submit"
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg text-white transition-colors duration-300 flex items-center justify-center"
            >
              <Search size={20} className="mr-2" />
              Track
            </button>
          </form>

          {showTrackingResult && trackingNumber && (
            <div className="mt-6 bg-white/5 rounded-lg p-4">
              <h3 className="text-xl font-bold mb-4">Tracking: {trackingNumber}</h3>
              <div className="relative">
                {getTrackingStatus().map((step, index) => (
                  <div key={index} className="flex mb-6 relative">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-4 ${
                      step.completed ? 'bg-green-500' : 'bg-gray-600'
                    }`}>
                      {step.completed ? '✓' : index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold">{step.status}</p>
                      <p className="text-blue-200 text-sm">{step.date || 'Pending'}</p>
                    </div>
                    {index < getTrackingStatus().length - 1 && (
                      <div className={`absolute left-4 top-8 w-0.5 h-6 ${
                        step.completed && getTrackingStatus()[index + 1].completed
                          ? 'bg-green-500'
                          : 'bg-gray-600'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {deliveryStats.map((stat, index) => (
            <div
              key={index}
              className="bg-white/10 backdrop-blur-lg rounded-lg p-4 md:p-6 text-white transition-all duration-300 transform hover:scale-105 hover:bg-white/20"
              onMouseEnter={() => setHoveredCard(index)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <div className={`${stat.color} p-3 rounded-full w-fit mb-4`}>
                <stat.icon size={24} />
              </div>
              <h2 className="text-xl md:text-2xl font-bold mb-2">{stat.value}</h2>
              <p className="text-blue-200">{stat.title}</p>
            </div>
          ))}
        </div>

        {/* Recent Deliveries */}
        <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4 md:p-6 text-white">
          <h2 className="text-xl md:text-2xl font-bold mb-4">Recent Deliveries</h2>
          {recentDeliveries.length > 0 ? (
            <div className="space-y-4">
              {recentDeliveries.map((delivery) => (
                <div
                  key={delivery.id}
                  className="bg-white/5 rounded-lg p-4 transition-all duration-300 hover:bg-white/10"
                >
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 md:gap-4">
                    <div>
                      <h3 className="font-bold">{delivery.id}</h3>
                      <p className="text-blue-200">{delivery.destination}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${
                        delivery.status === 'Delivered' ? 'text-green-400' : 
                        delivery.status === 'In Transit' ? 'text-yellow-400' : 'text-blue-200'
                      }`}>
                        {delivery.status}
                      </p>
                      <p className="text-sm text-blue-200">{delivery.date}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-4 text-blue-200">No deliveries found.</p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <button
            className="bg-white/10 backdrop-blur-lg rounded-lg p-4 md:p-6 text-white transition-all duration-300 hover:bg-white/20 text-left flex items-center justify-between"
            onClick={() => setShowProfileDetails(!showProfileDetails)}
          >
            <div className="flex items-center gap-4">
              <User size={24} />
              <span className="text-lg">Profile</span>
            </div>
            <ChevronRight size={24} />
          </button>
        </div>

        {/* Profile Details */}
        {showProfileDetails && (
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4 md:p-6 text-white animate-fadeIn">
            <h3 className="text-xl font-bold mb-4">Profile Details</h3>
            
            {isEditingProfile ? (
              <form onSubmit={handleProfileUpdate}>
                {profileError && (
                  <div className="bg-red-500/20 text-red-400 p-3 rounded-lg mb-4">
                    {profileError}
                  </div>
                )}
                
                <div className="flex items-center justify-center mb-6">
                  <div className="relative">
                    <div 
                      className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden bg-white/5 border-2 border-blue-500 cursor-pointer"
                      onClick={handlePhotoClick}
                    >
                      {profilePhoto ? (
                        <img 
                          src={profilePhoto} 
                          alt="Profile" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User size={48} />
                        </div>
                      )}
                    </div>
                    <div 
                      className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-2 cursor-pointer"
                      onClick={handlePhotoClick}
                    >
                      <Camera size={16} />
                    </div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handlePhotoChange}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div>
                    <label className="block mb-2">Name:</label>
                    <input
                      type="text"
                      name="username"
                      value={profileForm.username}
                      onChange={handleProfileFormChange}
                      className="w-full p-2 rounded-lg bg-white/5 text-white border border-white/20 focus:outline-none focus:ring focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block mb-2">Email:</label>
                    <input
                      type="email"
                      name="email"
                      value={profileForm.email}
                      onChange={handleProfileFormChange}
                      className="w-full p-2 rounded-lg bg-white/5 text-white border border-white/20 focus:outline-none focus:ring focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block mb-2">Phone:</label>
                    <input
                      type="text"
                      name="phone"
                      value={profileForm.phone}
                      onChange={handleProfileFormChange}
                      className="w-full p-2 rounded-lg bg-white/5 text-white border border-white/20 focus:outline-none focus:ring focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block mb-2">Address:</label>
                    <input
                      type="text"
                      name="address"
                      value={profileForm.address}
                      onChange={handleProfileFormChange}
                      className="w-full p-2 rounded-lg bg-white/5 text-white border border-white/20 focus:outline-none focus:ring focus:ring-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block mb-2">Bio:</label>
                    <textarea
                      name="bio"
                      value={profileForm.bio}
                      onChange={handleProfileFormChange}
                      rows="3"
                      className="w-full p-2 rounded-lg bg-white/5 text-white border border-white/20 focus:outline-none focus:ring focus:ring-blue-500"
                    ></textarea>
                  </div>
                </div>
                <div className="mt-4 flex gap-4">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-white transition-colors duration-300"
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 rounded-lg text-white transition-colors duration-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                <div className="flex flex-col items-center justify-center md:col-span-1">
                  <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden bg-white/5 border-2 border-blue-500 mb-2">
                    {user?.photoUrl ? (
                      <img 
                        src={user.photoUrl} 
                        alt="Profile" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User size={48} />
                      </div>
                    )}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="mb-2"><strong>Name:</strong> {user?.username}</p>
                      <p className="mb-2"><strong>Email:</strong> {user?.email}</p>
                      <p className="mb-2"><strong>Phone:</strong> {user?.phone || 'Not provided'}</p>
                      <p className="mb-2"><strong>Address:</strong> {user?.address || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className="mb-2"><strong>Total Orders:</strong> {orders.length}</p>
                      <p className="mb-2"><strong>Membership:</strong> {user?.membershipType || 'Standard'}</p>
                      <p className="mb-2"><strong>Account Status:</strong> <span className="text-green-400">Active</span></p>
                      <p className="mb-2"><strong>Bio:</strong> {user?.bio || 'No bio provided'}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleEditProfile}
                    className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-white transition-colors duration-300"
                  >
                    Edit Profile
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* All Orders - Updated with better contrast */}
        {orders.length > 0 && (
          <div className="bg-black/70 backdrop-blur-lg rounded-lg p-4 md:p-6 text-white">
            <h2 className="text-xl md:text-2xl font-bold mb-4">All Orders</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-500">
                <thead className="bg-black/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold">Order ID</th>
                    <th className="px-4 py-3 text-left font-bold">Date</th>
                    <th className="px-4 py-3 text-left font-bold">Destination</th>
                    <th className="px-4 py-3 text-left font-bold">Amount</th>
                    <th className="px-4 py-3 text-left font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-black/40 transition-colors">
                      <td className="px-4 py-3 font-medium">{order.id}</td>
                      <td className="px-4 py-3">{order.date}</td>
                      <td className="px-4 py-3">{order.destination}</td>
                      <td className="px-4 py-3">KES {order.amount}</td>
                      <td className="px-4 py-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium inline-flex items-center ${
                          order.status === 'Delivered' ? 'bg-green-900 text-green-300' :
                          order.status === 'In Transit' ? 'bg-yellow-900 text-yellow-300' :
                          order.status === 'Order Placed' ? 'bg-blue-900 text-blue-300' :
                          'bg-gray-800 text-gray-300'
                        }`}>
                          {order.status === 'Delivered' && <CheckCircle size={16} className="mr-2" />}
                          {order.status === 'In Transit' && <Truck size={16} className="mr-2" />}
                          {order.status === 'Order Placed' && <Package size={16} className="mr-2" />}
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserDashboard;