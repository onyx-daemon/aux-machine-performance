import React, { useState, useEffect } from 'react';
import { useContext } from 'react';
import { useAuth } from '../context/AuthContext';
import { ThemeContext } from '../App';
import { Config, Sensor } from '../types';
import apiService from '../services/api';
import {
  Settings,
  Network,
  Mail,
  Save,
  Cpu,
  Link,
  Plus,
  Trash2,
  Clock
} from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const Configuration: React.FC = () => {
  const { isAdmin } = useAuth();
  const { isDarkMode } = useContext(ThemeContext);
  const [config, setConfig] = useState<Config | null>(null);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [pinMappings, setPinMappings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('plc');
  const [emailRecipients, setEmailRecipients] = useState('');

  // Pin mapping state
  const [selectedSensor, setSelectedSensor] = useState('');
  const [selectedPin, setSelectedPin] = useState('');

  useEffect(() => {
    if (isAdmin) {
      fetchConfigData();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (config) {
      // Initialize recipients as comma-separated string
      setEmailRecipients(config.email.recipients.join(', '));
    }
  }, [config]);

  const fetchConfigData = async () => {
    try {
      const [configData, sensorsData, pinMappingsData] = await Promise.all([
        apiService.getConfig(),
        apiService.getSensors(),
        apiService.getPinMappings()
      ]);

      if (!configData.signalTimeouts) {
      configData.signalTimeouts = {
        powerSignalTimeout: 5,
        cycleSignalTimeout: 2
      };
    }
      
      setConfig(configData);
      setSensors(sensorsData);
      setPinMappings(pinMappingsData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch configuration';
      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 5000,
        theme: "dark"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfigUpdate = async (updatedConfig: Partial<Config>) => {
    setSaving(true);

    try {
      const newConfig = { ...config, ...updatedConfig } as Config;
      await apiService.updateConfig(newConfig);
      setConfig(newConfig);
      toast.success('Configuration updated successfully', {
        position: "top-right",
        autoClose: 3000,
        theme: "dark"
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update configuration';
      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 5000,
        theme: "dark"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMapping = async (mappingId: string) => {
    if (confirm('Are you sure you want to permanently delete this pin mapping?')) {
      try {
        await apiService.deletePinMapping(mappingId);
        toast.success('Pin mapping deleted successfully', {
          position: "top-right",
          autoClose: 3000,
          theme: "dark"
        });
        fetchConfigData(); // Refresh data
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete pin mapping';
        toast.error(errorMessage, {
          position: "top-right",
          autoClose: 5000,
          theme: "dark"
        });
      }
    }
  };

  const handlePinMapping = async () => {
    if (!selectedSensor || !selectedPin) return;

    try {
      await apiService.createPinMapping({
        sensorId: selectedSensor,
        pinId: selectedPin
      });
      
      toast.success('Pin mapping created successfully', {
        position: "top-right",
        autoClose: 3000,
        theme: "dark"
      });
      
      setSelectedSensor('');
      setSelectedPin('');
      fetchConfigData(); // Refresh data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create pin mapping';
      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 5000,
        theme: "dark"
      });
    }
  };

  const availablePins = Array.from({ length: 8 }, (_, i) => `DQ.${i}`);
  const occupiedPins = pinMappings.map(mapping => mapping.pinId);
  const availablePinsForSelection = availablePins.filter(pin => !occupiedPins.includes(pin));

  if (!isAdmin) {
    return (
      <div className={`border px-4 py-3 rounded-md flex items-center ${
        isDarkMode 
          ? 'bg-red-900/50 border-red-500 text-red-300'
          : 'bg-red-50 border-red-200 text-red-700'
      }`}>
        <AlertTriangle className="h-4 w-4 mr-2" />
        <span>Access denied. Admin privileges required.</span>
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
      {/* Toast container */}
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
      <div className="flex items-center space-x-4">
        <Settings className={`h-8 w-8 ${
          isDarkMode ? 'text-blue-400' : 'text-blue-500'
        }`} />
        <div>
          <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>System Configuration</h1>
          <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Configure PLC settings, email alerts, and sensor mappings</p>
        </div>
      </div>

      {/* Tabs */}
      <div className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'plc', label: 'PLC Configuration', icon: Cpu },
            { id: 'email', label: 'Email Settings', icon: Mail },
            { id: 'signals', label: 'Signal Settings', icon: Settings },
            { id: 'shifts', label: 'Shift Management', icon: Clock },
            { id: 'mapping', label: 'Pin Mapping', icon: Link }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? `border-blue-500 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`
                  : `border-transparent ${isDarkMode ? 'text-gray-400 hover:text-gray-300 hover:border-gray-300' : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'}`
              }`}
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6 px-4 sm:px-0">
        {/* PLC Configuration */}
        {activeTab === 'plc' && config && (
          <div className={`rounded-lg border p-6 ${
            isDarkMode 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200 shadow-sm'
          }`}>
            <div className="flex items-center space-x-2 mb-4">
              <Network className={`h-5 w-5 ${
                isDarkMode ? 'text-blue-400' : 'text-blue-500'
              }`} />
              <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>PLC Connection Settings</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  IP Address
                </label>
                <input
                  type="text"
                  value={config.plc.ip}
                  onChange={(e) => setConfig({
                    ...config,
                    plc: { ...config.plc, ip: e.target.value }
                  })}
                  className={`w-full rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="192.168.1.100"
                />
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Rack
                </label>
                <input
                  type="number"
                  value={config.plc.rack}
                  onChange={(e) => setConfig({
                    ...config,
                    plc: { ...config.plc, rack: parseInt(e.target.value) || 0 }
                  })}
                  className={`w-full rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="0"
                />
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Slot
                </label>
                <input
                  type="number"
                  value={config.plc.slot}
                  onChange={(e) => setConfig({
                    ...config,
                    plc: { ...config.plc, slot: parseInt(e.target.value) || 1 }
                  })}
                  className={`w-full rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="1"
                />
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => handleConfigUpdate({ plc: config.plc })}
                disabled={saving}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? 'Saving...' : 'Save PLC Settings'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Email Configuration */}
        {activeTab === 'email' && config && (
          <div className={`rounded-lg border p-6 ${
            isDarkMode 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200 shadow-sm'
          }`}>
            <div className="flex items-center space-x-2 mb-4">
              <Mail className={`h-5 w-5 ${
                isDarkMode ? 'text-blue-400' : 'text-blue-500'
              }`} />
              <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Outlook Email Alert Settings</h2>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Sender Email
                  </label>
                  <input
                    type="email"
                    value={config.email.senderEmail}
                    onChange={(e) => setConfig({
                      ...config,
                      email: { ...config.email, senderEmail: e.target.value }
                    })}
                    className={`w-full rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    placeholder="alerts@company.com"
                  />
                </div>
                
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    App Password
                  </label>
                  <input
                    type="password"
                    value={config.email.senderPassword}
                    onChange={(e) => setConfig({
                      ...config,
                      email: { ...config.email, senderPassword: e.target.value }
                    })}
                    className={`w-full rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    placeholder="App-specific password"
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Recipients (comma-separated)
                </label>
                  <textarea
                    value={emailRecipients}
                    onChange={(e) => setEmailRecipients(e.target.value)}
                    rows={3}
                    className={`w-full rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    placeholder="manager@company.com, operator@company.com"
                  />
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => {
                  // Split into array only when saving
                  const recipientsArray = emailRecipients
                    .split(',')
                    .map(email => email.trim())
                    .filter(Boolean);
                  
                  handleConfigUpdate({
                    email: {
                      ...config.email,
                      recipients: recipientsArray
                    }
                  });
                }}
                disabled={saving}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? 'Saving...' : 'Save Email Settings'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Signal Settings Tab */}
        {activeTab === 'signals' && config && (
          <div className={`rounded-lg border p-6 ${
            isDarkMode 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200 shadow-sm'
          }`}>
            <div className="flex items-center space-x-2 mb-4">
              <Settings className={`h-5 w-5 ${
                isDarkMode ? 'text-blue-400' : 'text-blue-500'
              }`} />
              <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Signal Timeout Settings</h2>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Power Signal Timeout (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={config.signalTimeouts?.powerSignalTimeout || 5}
                  onChange={(e) => setConfig({
                    ...config,
                    signalTimeouts: {
                      ...config.signalTimeouts,
                      powerSignalTimeout: parseInt(e.target.value) || 5
                    }
                  })}
                  className={`w-full rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
                <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Time after which machine is considered inactive if no power signal
                </p>
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Cycle Signal Timeout (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={config.signalTimeouts?.cycleSignalTimeout || 2}
                  onChange={(e) => setConfig({
                    ...config,
                    signalTimeouts: {
                      ...config.signalTimeouts,
                      cycleSignalTimeout: parseInt(e.target.value) || 2
                    }
                  })}
                  className={`w-full rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
                <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Time after which unclassified stoppage is detected if no cycle signal
                </p>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => handleConfigUpdate({ 
                  signalTimeouts: config.signalTimeouts 
                })}
                disabled={saving}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? 'Saving...' : 'Save Signal Settings'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Shift Management Tab - FIXED SECTION */}
        {activeTab === 'shifts' && config && (() => {
          const shifts = config.shifts || [];
          
          return (
            <div className="space-y-6">
              {/* Add New Shift */}
              <div className={`rounded-lg border p-6 ${
                isDarkMode 
                  ? 'bg-gray-800 border-gray-700' 
                  : 'bg-white border-gray-200 shadow-sm'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Clock className={`h-5 w-5 ${
                      isDarkMode ? 'text-blue-400' : 'text-blue-500'
                    }`} />
                    <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Shift Management</h2>
                  </div>
                  <button
                    onClick={() => {
                      const newShift = {
                        name: `Shift ${shifts.length + 1}`,
                        startTime: '08:00',
                        endTime: '16:00',
                        isActive: true
                      };
                      setConfig({
                        ...config,
                        shifts: [...shifts, newShift]
                      });
                    }}
                    className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Shift</span>
                  </button>
                </div>

                {shifts.length > 0 ? (
                  <div className="space-y-4">
                    {shifts.map((shift, index) => (
                      <div key={index} className={`rounded-lg p-4 ${
                        isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
                      }`}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                          <div>
                            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              Shift Name
                            </label>
                            <input
                              type="text"
                              value={shift.name}
                              onChange={(e) => {
                                const updatedShifts = [...shifts];
                                updatedShifts[index].name = e.target.value;
                                setConfig({ ...config, shifts: updatedShifts });
                              }}
                              className={`w-full rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                isDarkMode 
                                  ? 'bg-gray-600 border-gray-500 text-white' 
                                  : 'bg-white border-gray-300 text-gray-900'
                              }`}
                            />
                          </div>
                          
                          <div>
                            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              Start Time
                            </label>
                            <input
                              type="time"
                              value={shift.startTime}
                              onChange={(e) => {
                                const updatedShifts = [...shifts];
                                updatedShifts[index].startTime = e.target.value;
                                setConfig({ ...config, shifts: updatedShifts });
                              }}
                              className={`w-full rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                isDarkMode 
                                  ? 'bg-gray-600 border-gray-500 text-white' 
                                  : 'bg-white border-gray-300 text-gray-900'
                              }`}
                            />
                          </div>
                          
                          <div>
                            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              End Time
                            </label>
                            <input
                              type="time"
                              value={shift.endTime}
                              onChange={(e) => {
                                const updatedShifts = [...shifts];
                                updatedShifts[index].endTime = e.target.value;
                                setConfig({ ...config, shifts: updatedShifts });
                              }}
                              className={`w-full rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                isDarkMode 
                                  ? 'bg-gray-600 border-gray-500 text-white' 
                                  : 'bg-white border-gray-300 text-gray-900'
                              }`}
                            />
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center">
                              <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={shift.isActive}
                                onChange={(e) => {
                                  const updatedShifts = [...shifts];
                                  updatedShifts[index].isActive = e.target.checked;
                                  setConfig({ ...config, shifts: updatedShifts });
                                }}
                                className="sr-only peer"
                              />
                              <div className={`relative w-11 h-6 peer-focus:outline-none peer-focus:ring-4 ${
                                isDarkMode ? 'peer-focus:ring-blue-300' : 'peer-focus:ring-blue-200'
                              } rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 ${
                                isDarkMode ? 'bg-gray-600' : 'bg-gray-300'
                              }`}></div>
                              <span className={`ml-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Active</span>
                              </label>
                            </div>
                            
                            <button
                              onClick={() => {
                                const updatedShifts = shifts.filter((_, i) => i !== index);
                                setConfig({ ...config, shifts: updatedShifts });
                              }}
                              className={`p-1 ${isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-500 hover:text-red-700'}`}
                              title="Delete shift"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Clock className={`h-12 w-12 mx-auto mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                    <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>No shifts configured</p>
                    <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Add your first shift to get started</p>
                  </div>
                )}

                <div className="mt-6">
                  <button
                    onClick={() => handleConfigUpdate({ shifts })}
                    disabled={saving}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <Save className="h-4 w-4" />
                    <span>{saving ? 'Saving...' : 'Save Shifts'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Pin Mapping */}
        {activeTab === 'mapping' && (
          <div className="space-y-6">
            {/* Add New Mapping */}
            <div className={`rounded-lg border p-6 ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-200 shadow-sm'
            }`}>
              <div className="flex items-center space-x-2 mb-4">
                <Plus className={`h-5 w-5 ${
                  isDarkMode ? 'text-blue-400' : 'text-blue-500'
                }`} />
                <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Create Pin Mapping</h2>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Sensor
                  </label>
                  <select
                    value={selectedSensor}
                    onChange={(e) => setSelectedSensor(e.target.value)}
                    className={`w-full rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="">Select sensor...</option>
                    {sensors.filter(sensor => 
                      !pinMappings.some(mapping => mapping.sensorId._id === sensor._id)
                    ).map((sensor) => (
                      <option key={sensor._id} value={sensor._id}>
                        {sensor.name} ({sensor.sensorType})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    PLC Pin
                  </label>
                  <select
                    value={selectedPin}
                    onChange={(e) => setSelectedPin(e.target.value)}
                    className={`w-full rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="">Select pin...</option>
                    {availablePinsForSelection.map((pin) => (
                      <option key={pin} value={pin}>
                        {pin}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="flex items-end">
                  <button
                    onClick={handlePinMapping}
                    disabled={!selectedSensor || !selectedPin}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    <Link className="h-4 w-4" />
                    <span>Map Pin</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Current Mappings */}
            <div className={`rounded-lg border p-6 ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-200 shadow-sm'
            }`}>
              <h2 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Current Pin Mappings</h2>
              
              {pinMappings.length > 0 ? (
                <div className="space-y-3">
                  {pinMappings.map((mapping) => (
                    <div key={mapping._id} className={`rounded-lg p-4 flex items-center justify-between ${
                      isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
                    }`}>
                      <div className="flex items-center space-x-4">
                        <div className={`text-white px-3 py-1 rounded text-sm font-mono ${
                          isDarkMode ? 'bg-blue-600' : 'bg-blue-500'
                        }`}>
                          {mapping.pinId}
                        </div>
                        <div>
                          <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{mapping.sensorId.name}</div>
                          <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            {mapping.sensorId.sensorType} • Machine: {mapping.sensorId.machineId?.name || 'Unknown'}
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleDeleteMapping(mapping._id)}
                          className={`p-2 rounded ${
                            isDarkMode 
                              ? 'text-red-400 hover:bg-red-400/10' 
                              : 'text-red-500 hover:bg-red-50'
                          }`}
                          title="Delete permanently"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>No pin mappings configured</p>
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Create your first mapping above</p>
                </div>
              )}
            </div>

            {/* Pin Status Overview */}
            {activeTab === 'mapping' && (
              <div className={`rounded-lg border p-6 ${
                isDarkMode 
                  ? 'bg-gray-800 border-gray-700' 
                  : 'bg-white border-gray-200 shadow-sm'
              }`}>
                <h2 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>PLC Pin Status</h2>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                  {availablePins.map((pin) => {
                    const mapping = pinMappings.find(m => m.pinId === pin);
                    let statusClass = isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-400'
                      : 'bg-gray-100 border-gray-300 text-gray-600';
                    let statusText = 'Free';
                    
                    if (mapping) {
                      statusClass = isDarkMode
                        ? 'bg-green-900/50 border-green-500 text-green-300'
                        : 'bg-green-100 border-green-500 text-green-700';
                      statusText = 'Mapped';
                    }
                    
                    return (
                      <div
                        key={pin}
                        className={`p-3 rounded-lg border text-center ${statusClass}`}
                        title={mapping ? `Mapped to: ${mapping.sensorId.name}` : 'Available'}
                      >
                        <div className="font-mono text-sm">{pin}</div>
                        <div className="text-xs mt-1">
                          {statusText}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Configuration;