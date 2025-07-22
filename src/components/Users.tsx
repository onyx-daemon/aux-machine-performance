import React, { useState, useEffect } from 'react';
import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ThemeContext } from '../App';
import apiService from '../services/api';
import {
  Users as UsersIcon,
  User as UserIcon,
  Plus, 
  Edit, 
  Trash2, 
  Power, 
  PowerOff,
  Search,
  Loader,
  Building2,
  Eye,
  EyeOff
} from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const Users: React.FC = () => {
  const { isAdmin } = useAuth();
  const { isDarkMode } = useContext(ThemeContext);
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'operator',
    departmentId: '',
    isActive: true
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusTogglingId, setStatusTogglingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersData, departmentsData] = await Promise.all([
        apiService.getUsers(),
        apiService.getAllDepartments()
      ]);
      setUsers(usersData);
      setDepartments(departmentsData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch data';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (editingUser) {
      if (name === 'role' && value !== 'operator') {
        setEditingUser({ 
          ...editingUser, 
          [name]: value,
          departmentId: ''
        });
      } else {
        setEditingUser({ ...editingUser, [name]: value });
      }
    } else {
      if (name === 'role' && value !== 'operator') {
        setFormData({ 
          ...formData, 
          [name]: value,
          departmentId: ''
        });
      } else {
        setFormData({ ...formData, [name]: value });
      }
    }
  };

  useEffect(() => {
    if (!isCreating) return;
    if (formData.role !== 'operator') {
      setFormData(prev => ({ ...prev, departmentId: '' }));
    }
  }, [formData.role, isCreating]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userData: any = { ...formData };
      
      if (userData.role === 'admin') {
        userData.departmentId = undefined;
      }

      const newUser = await apiService.createUser(userData);
      setUsers([...users, newUser]);
      setFormData({
        username: '',
        email: '',
        password: '',
        role: 'operator',
        departmentId: '',
        isActive: true
      });
      setIsCreating(false);
      toast.success("User created successfully");
    } catch (err) {
      let message = 'Failed to create user';
      
      if (err instanceof Error) {
        if (err.message.includes('E11000 duplicate key error')) {
          if (err.message.includes('username')) {
            message = 'Username already exists';
          } else if (err.message.includes('email')) {
            message = 'Email already exists';
          }
        } else {
          message = err.message;
        }
      }
      
      toast.error(message);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    
    try {
      const updateData: any = {
        username: editingUser.username,
        email: editingUser.email,
        role: editingUser.role,
        isActive: editingUser.isActive
      };

      // Add password if provided
      if (editingUser.password && editingUser.password.trim() !== '') {
        updateData.password = editingUser.password;
      }

      if (editingUser.role === 'operator') {
        updateData.departmentId = editingUser.departmentId;
      } else {
        updateData.departmentId = undefined;
      }

      const updatedUser = await apiService.updateUser(editingUser._id, updateData);
      
      setUsers(users.map(user => 
        user._id === editingUser._id ? updatedUser : user
      ));
      setEditingUser(null);
      toast.success("User updated successfully");
    } catch (err) {
      let message = 'Failed to update user';
      
      if (err instanceof Error) {
        if (err.message.includes('E11000 duplicate key error')) {
          if (err.message.includes('username')) {
            message = 'Username already exists';
          } else if (err.message.includes('email')) {
            message = 'Email already exists';
          }
        } else {
          message = err.message;
        }
      }
      
      toast.error(message);
    }
  };

 
  const handleToggleStatus = async (id: string, isActive: boolean) => {
    try {
      setStatusTogglingId(id);
      const updatedUser = await apiService.updateUser(id, { 
        isActive: !isActive 
      });
      setUsers(users.map(user => 
        user._id === id ? updatedUser : user
      ));
      toast.success(`User ${!isActive ? 'activated' : 'deactivated'} successfully`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update user status';
      toast.error(message);
    } finally {
      setStatusTogglingId(null);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (window.confirm('Are you sure you want to permanently delete this user? This action cannot be undone.')) {
      try {
        setDeletingId(id);
        await apiService.deleteUser(id);
        setUsers(users.filter(user => user._id !== id));
        toast.success("User deleted successfully");
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete user';
        toast.error(message);
      } finally {
        setDeletingId(null);
      }
    }
  };

  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getDepartmentName = (deptData: any) => {
    if (!deptData) return 'N/A';
    
    if (typeof deptData === 'object' && deptData.name) {
      return deptData.name;
    }
    
    const department = departments.find(d => d._id === deptData);
    return department ? department.name : 'N/A';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
      <div className="space-y-6">
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme={isDarkMode ? "dark" : "light"}
      />
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <UsersIcon className="h-8 w-8 text-blue-400" />
          <div>
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>User Management</h1>
            <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Manage system users and their permissions</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search users..."
              className={`pl-10 pr-4 py-2 w-full rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                isDarkMode 
                  ? 'bg-gray-800 border-gray-700 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {isAdmin && (
            <button 
              onClick={() => setIsCreating(true)}
              className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              <Plus className="h-5 w-5" />
              <span>New User</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`p-4 rounded-lg border ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200 shadow-sm'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Users</p>
              <p className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{users.length}</p>
            </div>
            <UserIcon className="h-8 w-8 text-blue-400" />
          </div>
        </div>

        <div className={`p-4 rounded-lg border ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200 shadow-sm'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Active Users</p>
              <p className="text-xl font-semibold text-green-400">
                {users.filter(u => u.isActive).length}
              </p>
            </div>
            <Power className="h-8 w-8 text-green-400" />
          </div>
        </div>

        <div className={`p-4 rounded-lg border ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200 shadow-sm'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Admins</p>
              <p className="text-xl font-semibold text-yellow-400">
                {users.filter(u => u.role === 'admin').length}
              </p>
            </div>
            <UserIcon className="h-8 w-8 text-yellow-400" />
          </div>
        </div>
      </div>

      {/* Create User Modal */}
      {isCreating && (
        <div className={`fixed inset-0 flex items-center justify-center z-50 p-4 ${
          isDarkMode ? 'bg-black bg-opacity-50' : 'bg-gray-900 bg-opacity-50'
        }`}>
          <div className={`rounded-lg border w-full max-w-md ${
            isDarkMode 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200'
          }`}>
            <div className={`p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Create New User</h3>
                <button 
                  onClick={() => setIsCreating(false)}
                  className={isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'}
                >
                  &times;
                </button>
              </div>
            </div>
            
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label htmlFor="username" className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Username *
                </label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  required
                  className={`w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  value={formData.username}
                  onChange={handleInputChange}
                />
              </div>
              
              <div>
                <label htmlFor="email" className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Email *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  className={`w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  value={formData.email}
                  onChange={handleInputChange}
                />
              </div>
              
              <div>
                <label htmlFor="password" className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Password *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    name="password"
                    required
                    className={`w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    value={formData.password}
                    onChange={handleInputChange}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
              
              <div>
                <label htmlFor="role" className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Role *
                </label>
                <select
                  id="role"
                  name="role"
                  required
                  className={`w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  value={formData.role}
                  onChange={handleInputChange}
                >
                  <option value="admin">Admin</option>
                  <option value="operator">Operator</option>
                </select>
              </div>
              
              {formData.role === 'operator' && (
                <div>
                  <label htmlFor="departmentId" className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Department *
                  </label>
                  <select
                    id="departmentId"
                    name="departmentId"
                    required
                    className={`w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    value={formData.departmentId}
                    onChange={handleInputChange}
                  >
                    <option value="">Select Department</option>
                    {departments.map(dept => (
                      <option key={dept._id} value={dept._id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className={`px-4 py-2 border rounded-md ${
                    isDarkMode 
                      ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className={`fixed inset-0 flex items-center justify-center z-50 p-4 ${
          isDarkMode ? 'bg-black bg-opacity-50' : 'bg-gray-900 bg-opacity-50'
        }`}>
          <div className={`rounded-lg border w-full max-w-md ${
            isDarkMode 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200'
          }`}>
            <div className={`p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Edit User</h3>
                <button 
                  onClick={() => setEditingUser(null)}
                  className={isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'}
                >
                  &times;
                </button>
              </div>
            </div>
            
            <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
              <div>
                <label htmlFor="edit-username" className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Username *
                </label>
                <input
                  type="text"
                  id="edit-username"
                  name="username"
                  required
                  className={`w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  value={editingUser.username}
                  onChange={handleInputChange}
                />
              </div>
              
              <div>
                <label htmlFor="edit-email" className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Email *
                </label>
                <input
                  type="email"
                  id="edit-email"
                  name="email"
                  required
                  className={`w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  value={editingUser.email}
                  onChange={handleInputChange}
                />
              </div>
              
              {/* Password field for editing */}
              <div>
                <label htmlFor="edit-password" className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showEditPassword ? "text" : "password"}
                    id="edit-password"
                    name="password"
                    className={`w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    value={editingUser.password || ''}
                    onChange={handleInputChange}
                    placeholder="Leave blank to keep current password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                  >
                    {showEditPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
                <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  Only enter a value if you want to change the password
                </p>
              </div>
              
              <div>
                <label htmlFor="edit-role" className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Role *
                </label>
                <select
                  id="edit-role"
                  name="role"
                  required
                  className={`w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  value={editingUser.role}
                  onChange={handleInputChange}
                >
                  <option value="admin">Admin</option>
                  <option value="operator">Operator</option>
                </select>
              </div>
              
              {editingUser.role === 'operator' && (
                <div>
                  <label htmlFor="edit-departmentId" className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Department *
                  </label>
                  <select
                    id="edit-departmentId"
                    name="departmentId"
                    required
                    className={`w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    value={editingUser.departmentId || ''}
                    onChange={handleInputChange}
                  >
                    <option value="">Select Department</option>
                    {departments.map(dept => (
                      <option key={dept._id} value={dept._id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className={`px-4 py-2 border rounded-md ${
                    isDarkMode 
                      ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Update User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className={`rounded-lg border overflow-hidden ${
        isDarkMode 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-200 shadow-sm'
      }`}>
        <div className="overflow-x-auto">
          <table className={`min-w-full divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
            <thead className={isDarkMode ? 'bg-gray-750' : 'bg-gray-50'}>
              <tr>
                <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                  User
                </th>
                <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                  Role
                </th>
                <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                  Department
                </th>
                <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                  Status
                </th>
                <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                  Created
                </th>
                {isAdmin && (
                  <th scope="col" className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className={`divide-y ${
              isDarkMode 
                ? 'bg-gray-800 divide-gray-700' 
                : 'bg-white divide-gray-200'
            }`}>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr 
                    key={user._id} 
                    className={`${!user.isActive ? 'opacity-70' : ''} ${
                      isDarkMode ? 'hover:bg-gray-750' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
                          user.isActive ? 'bg-blue-500' : 'bg-gray-600'
                        }`}>
                          <UserIcon className="h-5 w-5 text-white" />
                        </div>
                        <div className="ml-4">
                          <div className={`text-sm font-medium flex items-center ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {user.username}
                            {!user.isActive && (
                              <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                                isDarkMode 
                                  ? 'bg-gray-700 text-gray-300' 
                                  : 'bg-gray-200 text-gray-600'
                              }`}>
                                Inactive
                              </span>
                            )}
                          </div>
                          <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.role === 'admin' 
                          ? 'bg-purple-900/50 text-purple-400' 
                          : 'bg-blue-900/50 text-blue-400'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm flex items-center ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                        {user.departmentId ? (
                          <>
                            <Building2 className="h-4 w-4 mr-1 text-blue-400" />
                            {getDepartmentName(user.departmentId)}
                          </>
                        ) : (
                          'N/A'
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.isActive 
                          ? 'bg-green-900/50 text-green-400' 
                          : 'bg-red-900/50 text-red-400'
                      }`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingUser({
                                ...user,
                                departmentId: user.departmentId 
                                  ? (typeof user.departmentId === 'object' 
                                      ? user.departmentId._id 
                                      : user.departmentId)
                                  : '',
                                password: '' // Initialize password field
                              });
                            }}
                            className={`p-1 rounded-md ${
                              isDarkMode 
                                ? 'text-blue-400 hover:text-blue-300 hover:bg-gray-700' 
                                : 'text-blue-500 hover:text-blue-700 hover:bg-blue-50'
                            }`}
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleStatus(user._id, user.isActive);
                            }}
                            disabled={statusTogglingId === user._id}
                            className={`p-1 rounded-md ${
                              user.isActive 
                                ? (isDarkMode ? 'text-yellow-400 hover:text-yellow-300 hover:bg-gray-700' : 'text-yellow-500 hover:text-yellow-700 hover:bg-yellow-50')
                                : (isDarkMode ? 'text-green-400 hover:text-green-300 hover:bg-gray-700' : 'text-green-500 hover:text-green-700 hover:bg-green-50')
                            } ${statusTogglingId === user._id ? 'opacity-50' : ''}`}
                            title={user.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {statusTogglingId === user._id ? (
                              <Loader className="h-4 w-4 animate-spin" />
                            ) : user.isActive ? (
                              <PowerOff className="h-4 w-4" />
                            ) : (
                              <Power className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteUser(user._id);
                            }}
                            disabled={deletingId === user._id}
                            className={`p-1 rounded-md ${
                              isDarkMode 
                                ? 'text-red-400 hover:text-red-300 hover:bg-gray-700' 
                                : 'text-red-500 hover:text-red-700 hover:bg-red-50'
                            } ${
                              deletingId === user._id ? 'opacity-50' : ''
                            }`}
                            title="Delete permanently"
                          >
                            {deletingId === user._id ? (
                              <Loader className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <UserIcon className={`h-12 w-12 mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                      <h3 className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>No users found</h3>
                      <p className={`max-w-md ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                        {searchTerm 
                          ? `No users match your search for "${searchTerm}"` 
                          : 'Get started by creating your first user'}
                      </p>
                      {isAdmin && !searchTerm && (
                        <button 
                          onClick={() => setIsCreating(true)}
                          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                          Create User
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Users;