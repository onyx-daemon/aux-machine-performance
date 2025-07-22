import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sensor, Machine, Department } from '../types';
import apiService from '../services/api';
import {
  Cpu,
  Plus,
  Edit,
  Trash2,
  Activity,
  Thermometer,
  Gauge,
  Zap,
  RotateCcw,
  Save,
  X,
  Search,
  Building2
} from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface SensorFormData {
  name: string;
  description: string;
  machineId: string;
  sensorType: 'power' | 'unit-cycle';
  isActive: boolean;
}

const Sensors: React.FC = () => {
  const { isAdmin } = useAuth();
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSensor, setEditingSensor] = useState<Sensor | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<SensorFormData>({
    name: '',
    description: '',
    machineId: '',
    sensorType: 'power',
    isActive: true
  });

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (selectedDepartment) {
      fetchMachinesByDepartment(selectedDepartment);
    }
  }, [selectedDepartment]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sensorsData, departmentsData, machinesData] = await Promise.all([
        apiService.getSensorsForAdmin(),
        apiService.getDepartments(),
        apiService.getMachines()
      ]);
      setSensors(sensorsData);
      setDepartments(departmentsData);
      setMachines(machinesData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch data';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Add this function to refresh data without affecting loading state
  const refreshData = async () => {
    try {
      const [sensorsData, departmentsData, machinesData] = await Promise.all([
        apiService.getSensorsForAdmin(),
        apiService.getDepartments(),
        apiService.getMachines()
      ]);
      setSensors(sensorsData);
      setDepartments(departmentsData);
      setMachines(machinesData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh data';
      toast.error(message);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const filteredSensors = sensors.filter(sensor => {
    const lowerSearch = searchTerm.toLowerCase();
    const machine = (sensor.machineId as Machine);
    const department = (machine.departmentId as Department);
    
    return (
      sensor.name.toLowerCase().includes(lowerSearch) ||
      (sensor.description && sensor.description.toLowerCase().includes(lowerSearch)) ||
      sensor.sensorType.toLowerCase().includes(lowerSearch) ||
      machine.name.toLowerCase().includes(lowerSearch) ||
      department.name.toLowerCase().includes(lowerSearch)
    );
  });

  const fetchMachinesByDepartment = async (departmentId: string) => {
    try {
      const machinesData = await apiService.getMachinesByDepartment(departmentId);
      setMachines(machinesData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch machines';
      toast.error(message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingSensor) {
        await apiService.updateSensor(editingSensor._id, formData);
        toast.success('Sensor updated successfully');
      } else {
        await apiService.createSensor(formData);
        toast.success('Sensor created successfully');
      }
      
      resetForm();
      // Refresh data to get populated information
      refreshData();
    } catch (err) {
      let message = 'Failed to save sensor';
      
      if (err instanceof Error) {
        if (err.message.includes('E11000 duplicate key error')) {
          message = 'Sensor name must be unique';
        } else {
          message = err.message;
        }
      }
      
      toast.error(message);
    }
  };

  const handleEdit = (sensor: Sensor) => {
    setEditingSensor(sensor);
    const machine = (sensor.machineId as Machine);
    const department = (machine.departmentId as Department);
    
    setFormData({
      name: sensor.name,
      description: sensor.description || '',
      machineId: machine._id,
      isActive: sensor.isActive,
      sensorType: sensor.sensorType
    });
    
    setSelectedDepartment(department._id);
    setShowForm(true);
  };

  const handleDelete = async (sensorId: string) => {
    if (!confirm('Are you sure you want to delete this sensor?')) return;

    try {
      await apiService.deleteSensor(sensorId);
      // Refresh data instead of local state update
      refreshData();
      toast.success('Sensor deleted successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete sensor';
      toast.error(message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      machineId: '',
      isActive: true,
      sensorType: 'power'
    });
    setEditingSensor(null);
    setSelectedDepartment('');
    setShowForm(false);
  };

  const getSensorIcon = (type: string) => {
    switch (type) {
      case 'power': return <Zap className="h-4 w-4" />;
      case 'unit-cycle': return <RotateCcw className="h-4 w-4" />;
      case 'temperature': return <Thermometer className="h-4 w-4" />;
      case 'pressure': return <Gauge className="h-4 w-4" />;
      case 'vibration': return <Activity className="h-4 w-4" />;
      default: return <Cpu className="h-4 w-4" />;
    }
  };

  const getSensorTypeColor = (type: string) => {
    switch (type) {
      case 'power': return 'text-yellow-400 bg-yellow-400/10';
      case 'unit-cycle': return 'text-blue-400 bg-blue-400/10';
      case 'temperature': return 'text-red-400 bg-red-400/10';
      case 'pressure': return 'text-purple-400 bg-purple-400/10';
      case 'vibration': return 'text-green-400 bg-green-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
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
          <Cpu className="h-8 w-8 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Sensor Management</h1>
            <p className="text-gray-400">Manage sensors and their machine assignments</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search sensors..."
              className="pl-10 pr-4 py-2 w-full bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchTerm}
              onChange={handleSearch}
            />
          </div>
          
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Add Sensor</span>
          </button>
        </div>
      </div>

      {/* Sensor Form Modal */}
      {showForm && (
        <div className={`fixed inset-0 flex items-center justify-center z-50 ${
          isDarkMode ? 'bg-black bg-opacity-50' : 'bg-gray-900 bg-opacity-50'
        }`}>
          <div className="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">
            isDarkMode 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200'
          }`}>
            <div className={`flex items-center justify-between p-6 border-b ${
              isDarkMode ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <h3 className={`text-lg font-semibold ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                {editingSensor ? 'Edit Sensor' : 'Add New Sensor'}
              </h3>
              <button
                onClick={resetForm}
                className={`transition-colors ${
                  isDarkMode 
                    ? 'text-gray-400 hover:text-white' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Sensor Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="Enter sensor name"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className={`w-full rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="Enter sensor description"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                Sensor Type *
                </label>
                <select
                required
                value={formData.sensorType}
                onChange={(e) => setFormData({ ...formData, sensorType: e.target.value as any })}
                className={`w-full rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                >
                <option value="power">Power Sensor</option>
                <option value="unit-cycle">Unit Cycle Sensor</option>
                </select>
            </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Department *
                </label>
                <select
                  required
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
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
                  Machine *
                </label>
                <select
                  required
                  value={formData.machineId}
                  onChange={(e) => setFormData({ ...formData, machineId: e.target.value })}
                  className={`w-full rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  disabled={!selectedDepartment}
                >
                  <option value="">Select machine</option>
                  {machines.map((machine) => (
                    <option key={machine._id} value={machine._id}>
                      {machine.name}
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
                  <Save className="h-4 w-4" />
                  <span>{editingSensor ? 'Update Sensor' : 'Create Sensor'}</span>
                </button>
                <button
                  type="button"
                  onClick={resetForm}
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

      {/* Sensors List */}
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
          }`}>System Sensors</h2>
        </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
          {filteredSensors.map((sensor) => {
            const machine = (sensor.machineId as Machine);
            const department = (machine.departmentId as Department);
            
            return (
              <div 
                key={sensor._id} 
                className={`rounded-lg border p-4 hover:border-blue-500 transition-colors ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600' 
                    : 'bg-white border-gray-200 shadow-sm'
                } ${
                  !sensor.isActive ? 'opacity-70' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className={`p-2 rounded-lg ${getSensorTypeColor(sensor.sensorType)}`}>
                      {getSensorIcon(sensor.sensorType)}
                    </div>
                    <div>
                      <h3 className={`font-medium ${
                        isDarkMode ? 'text-white' : 'text-gray-900'
                      }`}>{sensor.name}</h3>
                      <p className={`text-xs capitalize ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {sensor.sensorType.replace('-', ' ')} Sensor
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleEdit(sensor)}
                      className={`p-1 ${
                        isDarkMode 
                          ? 'text-blue-400 hover:text-blue-300' 
                          : 'text-blue-500 hover:text-blue-700'
                      }`}
                      title="Edit sensor"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(sensor._id)}
                      className={`p-1 ${
                        isDarkMode 
                          ? 'text-red-400 hover:text-red-300' 
                          : 'text-red-500 hover:text-red-700'
                      }`}
                      title="Delete sensor"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {sensor.description && (
                  <p className={`text-sm mb-3 line-clamp-2 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    {sensor.description}
                  </p>
                )}

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Machine:</span>
                    <span className={`font-medium ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {machine?.name || 'Unknown'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Department:</span>
                    <div className="flex items-center space-x-1">
                      <Building2 className={`h-3 w-3 ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`} />
                      <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>
                        {department?.name || 'Unknown'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Status:</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      sensor.isActive 
                        ? 'bg-green-900/50 text-green-300' 
                        : 'bg-red-900/50 text-red-300'
                    }`}>
                      {sensor.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {sensors.length === 0 && (
          <div className="text-center py-12">
            <Cpu className={`h-12 w-12 mx-auto mb-4 ${
              isDarkMode ? 'text-gray-600' : 'text-gray-400'
            }`} />
            <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>No sensors found</p>
            <p className={`text-sm mt-1 ${
              isDarkMode ? 'text-gray-500' : 'text-gray-500'
            }`}>Create your first sensor to get started</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sensors;