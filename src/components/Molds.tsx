import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mold, Department } from '../types';
import apiService from '../services/api';
import { 
  PackagePlus, 
  Plus, 
  Edit, 
  Trash2, 
  Power, 
  PowerOff,
  Search,
  Loader,
  PackageOpen,
  X,
  Save
} from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const Molds: React.FC = () => {
  const { isAdmin } = useAuth();
  const [molds, setMolds] = useState<Mold[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingMold, setEditingMold] = useState<Mold | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    productionCapacityPerHour: 0,
    departmentId: '',
    isActive: true
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusTogglingId, setStatusTogglingId] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [moldsData, departmentsData] = await Promise.all([
        apiService.getAllMolds(),
        apiService.getDepartments()
      ]);
      
      // Enrich molds with department names
      const enrichedMolds = moldsData.map((mold: Mold) => {
        if (typeof mold.departmentId === 'string') {
          const department = departmentsData.find((d: Department) => d._id === mold.departmentId);
          return {
            ...mold,
            departmentId: department 
              ? { _id: department._id, name: department.name } 
              : { _id: mold.departmentId, name: 'Unknown' }
          };
        }
        return mold;
      });

      
      setMolds(enrichedMolds);
      setDepartments(departmentsData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch data';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Helper to get department name
  const getDepartmentName = (mold: Mold) => {
    if (typeof mold.departmentId === 'object') {
      return mold.departmentId.name;
    }
    const department = departments.find(d => d._id === mold.departmentId);
    return department ? department.name : 'Unknown';
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const filteredMolds = molds.filter(mold => {
    const lowerSearch = searchTerm.toLowerCase();
    const deptName = getDepartmentName(mold).toLowerCase();
    
    return (
      mold.name.toLowerCase().includes(lowerSearch) ||
      (mold.description && mold.description.toLowerCase().includes(lowerSearch)) ||
      deptName.includes(lowerSearch) ||
      mold.productionCapacityPerHour.toString().includes(lowerSearch)
    );
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (editingMold) {
      setEditingMold({ ...editingMold, [name]: value });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleNumberInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = parseFloat(value);
    if (editingMold) {
      setEditingMold({ ...editingMold, [name]: numValue });
    } else {
      setFormData({ ...formData, [name]: numValue });
    }
  };

  const handleToggleStatus = async (id: string, isActive: boolean) => {
    try {
      setStatusTogglingId(id);
      await apiService.toggleMoldStatus(id);
      setMolds(molds.map(mold => 
        mold._id === id ? { ...mold, isActive: !isActive } : mold
      ));
      toast.success(`Mold ${!isActive ? 'activated' : 'deactivated'} successfully`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to toggle mold status';
      toast.error(message);
    } finally {
      setStatusTogglingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this mold? This action cannot be undone.')) return;

    try {
      setDeletingId(id);
      await apiService.deleteMold(id);
      setMolds(molds.filter(mold => mold._id !== id));
      toast.success('Mold deleted successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete mold';
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateMold = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newMold = await apiService.createMold(formData);
      
      // Find department name from stored departments
      const department = departments.find(d => d._id === formData.departmentId);
      
      // Create enhanced mold object with department name
      const enhancedMold = {
        ...newMold,
        departmentId: {
          _id: newMold.departmentId,
          name: department?.name || 'Unknown'
        }
      };

      setMolds([...molds, enhancedMold]);
      setIsCreating(false);
      setFormData({
        name: '',
        description: '',
        productionCapacityPerHour: 0,
        departmentId: '',
        isActive: true
      });
      toast.success('Mold created successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create mold';
      toast.error(message);
    }
  };

  const handleUpdateMold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMold) return;
    
    try {
      const updatedMold = await apiService.updateMold(editingMold._id, editingMold);
      
      // Find department name from stored departments
      const department = departments.find(d => d._id === editingMold.departmentId);
      
      // Create enhanced mold object with department name
      const enhancedMold = {
        ...updatedMold,
        departmentId: {
          _id: updatedMold.departmentId,
          name: department?.name || 'Unknown'
        }
      };

      setMolds(molds.map(mold => 
        mold._id === editingMold._id ? enhancedMold : mold
      ));
      setEditingMold(null);
      toast.success('Mold updated successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update mold';
      toast.error(message);
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-red-900/50 border border-red-500 text-red-300 px-4 py-3 rounded-md">
        <div className="flex items-center">
          <div className="h-4 w-4 mr-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
            </svg>
          </div>
          <span>Access denied. Admin privileges required.</span>
        </div>
      </div>
    );
  }

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
        theme="dark"
      />
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <PackageOpen className="h-8 w-8 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Mold Management</h1>
            <p className="text-gray-400">Manage and configure production molds</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search molds..."
              className="pl-10 pr-4 py-2 w-full bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchTerm}
              onChange={handleSearch}
            />
          </div>
          
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Add Mold</span>
          </button>
        </div>
      </div>

      {/* Create Mold Modal */}
      {isCreating && (
        <div className={`fixed inset-0 flex items-center justify-center z-50 ${
          isDarkMode ? 'bg-black bg-opacity-50' : 'bg-gray-900 bg-opacity-50'
        }`}>
          <div className={`rounded-lg border w-full max-w-md mx-4 ${
            isDarkMode 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200'
          }`}>
            <div className={`flex items-center justify-between p-6 border-b ${
              isDarkMode ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <h3 className={`text-lg font-semibold ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>Create New Mold</h3>
              <button
                onClick={() => setIsCreating(false)}
                className={`transition-colors ${
                  isDarkMode 
                    ? 'text-gray-400 hover:text-white' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMold} className="p-6 space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Mold Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  className={`w-full rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="Enter mold name"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  className={`w-full rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="Enter mold description"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Production Capacity (units/hour) *
                </label>
                <input
                  type="number"
                  name="productionCapacityPerHour"
                  required
                  min="1"
                  value={formData.productionCapacityPerHour}
                  onChange={handleNumberInputChange}
                  className={`w-full rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="Enter production capacity"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Department *
                </label>
                <select
                  name="departmentId"
                  required
                  value={formData.departmentId}
                  onChange={handleInputChange}
                  className={`w-full rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="">Select department</option>
                  {departments.map((dept) => (
                    <option key={dept._id} value={dept._id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Active Status
                </label>
                <div className="flex items-center">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className={`w-11 h-6 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 ${
                      isDarkMode ? 'bg-gray-700' : 'bg-gray-300'
                    }`}></div>
                    <span className={`ml-3 text-sm ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {formData.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <PackagePlus className="h-4 w-4" />
                  <span>Create Mold</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    isDarkMode 
                      ? 'bg-gray-600 text-white hover:bg-gray-700' 
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Mold Modal */}
      {editingMold && (
        <div className={`fixed inset-0 flex items-center justify-center z-50 ${
          isDarkMode ? 'bg-black bg-opacity-50' : 'bg-gray-900 bg-opacity-50'
        }`}>
          <div className={`rounded-lg border w-full max-w-md mx-4 ${
            isDarkMode 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200'
          }`}>
            <div className={`flex items-center justify-between p-6 border-b ${
              isDarkMode ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <h3 className={`text-lg font-semibold ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>Edit Mold</h3>
              <button
                onClick={() => setEditingMold(null)}
                className={`transition-colors ${
                  isDarkMode 
                    ? 'text-gray-400 hover:text-white' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateMold} className="p-6 space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Mold Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  value={editingMold.name}
                  onChange={handleInputChange}
                  className={`w-full rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="Enter mold name"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Description
                </label>
                <textarea
                  name="description"
                  value={editingMold.description || ''}
                  onChange={handleInputChange}
                  rows={3}
                  className={`w-full rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="Enter mold description"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Production Capacity (units/hour) *
                </label>
                <input
                  type="number"
                  name="productionCapacityPerHour"
                  required
                  min="1"
                  value={editingMold.productionCapacityPerHour}
                  onChange={handleNumberInputChange}
                  className={`w-full rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="Enter production capacity"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Department *
                </label>
                <select
                  name="departmentId"
                  required
                  value={typeof editingMold.departmentId === 'string' 
                    ? editingMold.departmentId 
                    : editingMold.departmentId._id}
                  onChange={handleInputChange}
                  className={`w-full rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="">Select department</option>
                  {departments.map((dept) => (
                    <option key={dept._id} value={dept._id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Active Status
                </label>
                <div className="flex items-center">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={editingMold.isActive}
                      onChange={(e) => setEditingMold({ ...editingMold, isActive: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className={`w-11 h-6 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 ${
                      isDarkMode ? 'bg-gray-700' : 'bg-gray-300'
                    }`}></div>
                    <span className={`ml-3 text-sm ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {editingMold.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Save className="h-4 w-4" />
                  <span>Update Mold</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingMold(null)}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    isDarkMode 
                      ? 'bg-gray-600 text-white hover:bg-gray-700' 
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Molds List */}
      <div className={`rounded-lg border ${
        isDarkMode 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-200 shadow-sm'
      }`}>
        <div className={`p-6 border-b ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <h2 className={`text-lg font-semibold ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>Production Molds</h2>
        </div>

        <div className="overflow-x-auto">
          <table className={`min-w-full divide-y ${
            isDarkMode ? 'divide-gray-700' : 'divide-gray-200'
          }`}>
            <thead className={isDarkMode ? 'bg-gray-750' : 'bg-gray-50'}>
              <tr>
                <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-500'
                }`}>
                  Mold
                </th>
                <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-500'
                }`}>
                  Department
                </th>
                <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-500'
                }`}>
                  Capacity
                </th>
                <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-500'
                }`}>
                  Status
                </th>
                <th scope="col" className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-500'
                }`}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${
              isDarkMode 
                ? 'bg-gray-800 divide-gray-700' 
                : 'bg-white divide-gray-200'
            }`}>
              {filteredMolds.length > 0 ? (
                filteredMolds.map((mold) => (
                  <tr key={mold._id} className={
                    isDarkMode ? 'hover:bg-gray-750' : 'hover:bg-gray-50'
                  }>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center ${
                          mold.isActive 
                            ? (isDarkMode ? 'bg-blue-500' : 'bg-blue-500') 
                            : (isDarkMode ? 'bg-gray-600' : 'bg-gray-400')
                        }`}>
                          <PackageOpen className="h-6 w-6 text-white" />
                        </div>
                        <div className="ml-4">
                          <div className={`text-sm font-medium ${
                            isDarkMode ? 'text-white' : 'text-gray-900'
                          }`}>
                            {mold.name}
                          </div>
                          <div className={`text-xs line-clamp-1 ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            {mold.description || 'No description'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        {getDepartmentName(mold)}
                      </div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {mold.productionCapacityPerHour} units/hour
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        mold.isActive 
                          ? 'bg-green-900/50 text-green-400' 
                          : 'bg-red-900/50 text-red-400'
                      }`}>
                        {mold.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => {
                            // Ensure departmentId is a string for editing
                            setEditingMold({
                              ...mold,
                              departmentId: typeof mold.departmentId === 'object' 
                                ? mold.departmentId._id 
                                : mold.departmentId
                            });
                          }}
                          className={`p-1 rounded-md transition-colors ${
                            isDarkMode 
                              ? 'text-blue-400 hover:text-blue-300 hover:bg-gray-700' 
                              : 'text-blue-500 hover:text-blue-700 hover:bg-blue-50'
                          }`}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(mold._id, mold.isActive)}
                          disabled={statusTogglingId === mold._id}
                          className={`p-1 rounded-md transition-colors ${
                            mold.isActive 
                              ? (isDarkMode ? 'text-yellow-400 hover:text-yellow-300 hover:bg-gray-700' : 'text-yellow-500 hover:text-yellow-700 hover:bg-yellow-50')
                              : (isDarkMode ? 'text-green-400 hover:text-green-300 hover:bg-gray-700' : 'text-green-500 hover:text-green-700 hover:bg-green-50')
                          } ${statusTogglingId === mold._id ? 'opacity-50' : ''}`}
                          title={mold.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {statusTogglingId === mold._id ? (
                            <Loader className="h-4 w-4 animate-spin" />
                          ) : mold.isActive ? (
                            <PowerOff className="h-4 w-4" />
                          ) : (
                            <Power className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(mold._id)}
                          disabled={deletingId === mold._id}
                          className={`p-1 rounded-md transition-colors ${
                            isDarkMode 
                              ? 'text-red-400 hover:text-red-300 hover:bg-gray-700' 
                              : 'text-red-500 hover:text-red-700 hover:bg-red-50'
                          } ${
                            deletingId === mold._id ? 'opacity-50' : ''
                          }`}
                          title="Delete"
                        >
                          {deletingId === mold._id ? (
                            <Loader className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <PackageOpen className={`h-12 w-12 mb-4 ${
                        isDarkMode ? 'text-gray-600' : 'text-gray-400'
                      }`} />
                      <h3 className={`text-lg font-medium mb-2 ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>No molds found</h3>
                      <p className={`max-w-md ${
                        isDarkMode ? 'text-gray-500' : 'text-gray-500'
                      }`}>
                        {searchTerm 
                          ? `No molds match your search for "${searchTerm}"` 
                          : 'Get started by creating your first mold'}
                      </p>
                      <button 
                        onClick={() => setIsCreating(true)}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        Create Mold
                      </button>
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

export default Molds;