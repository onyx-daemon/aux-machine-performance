import React, { useState, useEffect } from 'react';
import { useContext } from 'react';
import { ThemeContext } from '../App';
import { ProductionTimelineDay, ProductionHour, User, Mold } from '../types';
import apiService from '../services/api';
import {
  Clock,
  User as UserIcon,
  Package,
  AlertTriangle,
  Play,
  Pause,
  Settings,
  X,
  Save,
  Plus
} from 'lucide-react';

interface ProductionTimelineProps {
  data: ProductionTimelineDay[];
  machineId: string;
  onAddStoppage: (stoppage: any) => void;
  onUpdateProduction: (machineId: string, hour: number, date: string, data: any) => void;
}

const ProductionTimeline: React.FC<ProductionTimelineProps> = ({
  data,
  machineId,
  onAddStoppage,
  onUpdateProduction
}) => {
  const { isDarkMode } = useContext(ThemeContext);
  const [selectedHour, setSelectedHour] = useState<{day: string, hour: number} | null>(null);
  const [showStoppageModal, setShowStoppageModal] = useState(false);
  const [showProductionModal, setShowProductionModal] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [molds, setMolds] = useState<Mold[]>([]);
  const [stoppageForm, setStoppageForm] = useState({
    reason: '',
    description: '',
    duration: 0,
    sapNotificationNumber: ''
  });
  const [productionForm, setProductionForm] = useState({
    operatorId: '',
    moldId: '',
    defectiveUnits: 0,
    applyToShift: false
  });

  useEffect(() => {
    fetchUsers();
    fetchMolds();
  }, []);

  const fetchUsers = async () => {
    try {
      const usersData = await apiService.getUsers();
      setUsers(usersData.filter((user: User) => user.role === 'operator'));
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchMolds = async () => {
    try {
      const moldsData = await apiService.getMolds();
      setMolds(moldsData);
    } catch (error) {
      console.error('Failed to fetch molds:', error);
    }
  };

  const getStatusColor = (status: string, hasStoppages: boolean) => {
    if (hasStoppages) {
      return isDarkMode ? 'bg-red-600' : 'bg-red-500';
    }
    
    switch (status) {
      case 'running':
        return isDarkMode ? 'bg-green-600' : 'bg-green-500';
      case 'stoppage':
        return isDarkMode ? 'bg-red-600' : 'bg-red-500';
      case 'stopped_yet_producing':
        return isDarkMode ? 'bg-orange-600' : 'bg-orange-500';
      case 'inactive':
        return isDarkMode ? 'bg-gray-600' : 'bg-gray-400';
      default:
        return isDarkMode ? 'bg-gray-600' : 'bg-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Play className="h-3 w-3" />;
      case 'stoppage':
        return <Pause className="h-3 w-3" />;
      case 'stopped_yet_producing':
        return <AlertTriangle className="h-3 w-3" />;
      default:
        return <Settings className="h-3 w-3" />;
    }
  };

  const handleHourClick = (date: string, hour: number, hourData: ProductionHour) => {
    setSelectedHour({ day: date, hour });
    
    // Pre-fill production form with existing data
    setProductionForm({
      operatorId: hourData.operator?._id || hourData.operator?.id || '',
      moldId: hourData.mold?._id || hourData.mold?.id || '',
      defectiveUnits: hourData.defectiveUnits || 0,
      applyToShift: false
    });
  };

  const handleAddStoppage = async () => {
    if (!selectedHour) return;

    const stoppageData = {
      ...stoppageForm,
      machineId,
      hour: selectedHour.hour,
      date: selectedHour.day
    };

    await onAddStoppage(stoppageData);
    setShowStoppageModal(false);
    setStoppageForm({
      reason: '',
      description: '',
      duration: 0,
      sapNotificationNumber: ''
    });
  };

  const handleUpdateProduction = async () => {
    if (!selectedHour) return;

    await onUpdateProduction(machineId, selectedHour.hour, selectedHour.day, productionForm);
    setShowProductionModal(false);
  };

  const closeModals = () => {
    setShowStoppageModal(false);
    setShowProductionModal(false);
    setSelectedHour(null);
    setStoppageForm({
      reason: '',
      description: '',
      duration: 0,
      sapNotificationNumber: ''
    });
  };

  return (
    <div className="space-y-4">
      {/* Timeline Grid */}
      <div className="space-y-4">
        {data.map((day) => (
          <div key={day.date} className={`rounded-lg border p-4 ${
            isDarkMode 
              ? 'bg-gray-700 border-gray-600' 
              : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {new Date(day.date).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </h3>
              <div className="flex items-center space-x-2 text-sm">
                <div className="flex items-center space-x-1">
                  <div className={`w-3 h-3 rounded-full ${isDarkMode ? 'bg-green-600' : 'bg-green-500'}`}></div>
                  <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Running</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className={`w-3 h-3 rounded-full ${isDarkMode ? 'bg-red-600' : 'bg-red-500'}`}></div>
                  <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Stoppage</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className={`w-3 h-3 rounded-full ${isDarkMode ? 'bg-gray-600' : 'bg-gray-400'}`}></div>
                  <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Inactive</span>
                </div>
              </div>
            </div>

            {/* Hours Grid */}
            <div className="grid grid-cols-12 gap-1">
              {day.hours.map((hour) => (
                <div
                  key={hour.hour}
                  onClick={() => handleHourClick(day.date, hour.hour, hour)}
                  className={`relative h-16 rounded cursor-pointer transition-all duration-200 hover:scale-105 ${
                    getStatusColor(hour.status, hour.stoppages.length > 0)
                  } ${
                    selectedHour?.day === day.date && selectedHour?.hour === hour.hour
                      ? 'ring-2 ring-blue-400 ring-offset-2'
                      : ''
                  }`}
                  title={`${hour.hour}:00 - ${hour.unitsProduced} units - ${hour.status}`}
                >
                  <div className="absolute inset-0 p-1 flex flex-col justify-between text-white text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{hour.hour.toString().padStart(2, '0')}</span>
                      {getStatusIcon(hour.status)}
                    </div>
                    <div className="text-center">
                      <div className="font-semibold">{hour.unitsProduced}</div>
                      {hour.defectiveUnits > 0 && (
                        <div className="text-red-200 text-xs">-{hour.defectiveUnits}</div>
                      )}
                    </div>
                  </div>
                  
                  {/* Stoppage indicator */}
                  {hour.stoppages.length > 0 && (
                    <div className="absolute top-0 right-0 w-2 h-2 bg-red-400 rounded-full border border-white"></div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Hour Details Panel */}
      {selectedHour && (
        <div className={`rounded-lg border p-4 ${
          isDarkMode 
            ? 'bg-gray-700 border-gray-600' 
            : 'bg-white border-gray-200 shadow-sm'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {new Date(selectedHour.day).toLocaleDateString()} - {selectedHour.hour}:00
            </h3>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowStoppageModal(true)}
                className="flex items-center space-x-1 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                <Plus className="h-4 w-4" />
                <span>Add Stoppage</span>
              </button>
              <button
                onClick={() => setShowProductionModal(true)}
                className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                <Settings className="h-4 w-4" />
                <span>Update Production</span>
              </button>
              <button
                onClick={closeModals}
                className={`p-1 rounded ${
                  isDarkMode 
                    ? 'text-gray-400 hover:text-white hover:bg-gray-600' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Hour details content */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`p-3 rounded border ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-600' 
                : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex items-center space-x-2 mb-2">
                <Package className="h-4 w-4 text-blue-400" />
                <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Production</span>
              </div>
              <div className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {data.find(d => d.date === selectedHour.day)?.hours.find(h => h.hour === selectedHour.hour)?.unitsProduced || 0} units
              </div>
              {(data.find(d => d.date === selectedHour.day)?.hours.find(h => h.hour === selectedHour.hour)?.defectiveUnits || 0) > 0 && (
                <div className="text-sm text-red-400">
                  {data.find(d => d.date === selectedHour.day)?.hours.find(h => h.hour === selectedHour.hour)?.defectiveUnits} defective
                </div>
              )}
            </div>

            <div className={`p-3 rounded border ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-600' 
                : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex items-center space-x-2 mb-2">
                <UserIcon className="h-4 w-4 text-green-400" />
                <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Operator</span>
              </div>
              <div className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {data.find(d => d.date === selectedHour.day)?.hours.find(h => h.hour === selectedHour.hour)?.operator?.username || 'Not assigned'}
              </div>
            </div>

            <div className={`p-3 rounded border ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-600' 
                : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex items-center space-x-2 mb-2">
                <Settings className="h-4 w-4 text-purple-400" />
                <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Mold</span>
              </div>
              <div className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {data.find(d => d.date === selectedHour.day)?.hours.find(h => h.hour === selectedHour.hour)?.mold?.name || 'Not assigned'}
              </div>
            </div>
          </div>

          {/* Stoppages */}
          {data.find(d => d.date === selectedHour.day)?.hours.find(h => h.hour === selectedHour.hour)?.stoppages.length > 0 && (
            <div className="mt-4">
              <h4 className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Stoppages</h4>
              <div className="space-y-2">
                {data.find(d => d.date === selectedHour.day)?.hours.find(h => h.hour === selectedHour.hour)?.stoppages.map((stoppage, index) => (
                  <div key={index} className={`p-2 rounded border text-sm ${
                    isDarkMode 
                      ? 'bg-gray-800 border-gray-600' 
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={`font-medium capitalize ${
                        stoppage.reason === 'breakdown' ? 'text-red-400' : 
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        {stoppage.reason.replace('_', ' ')}
                      </span>
                      <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                        {stoppage.duration} min
                      </span>
                    </div>
                    {stoppage.description && (
                      <p className={`mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {stoppage.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stoppage Modal */}
      {showStoppageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`rounded-lg w-full max-w-md mx-4 ${
            isDarkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className={`p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Add Stoppage</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Reason *
                </label>
                <select
                  value={stoppageForm.reason}
                  onChange={(e) => setStoppageForm({...stoppageForm, reason: e.target.value})}
                  className={`w-full px-3 py-2 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="">Select reason</option>
                  <option value="planned">Planned Maintenance</option>
                  <option value="mold_change">Mold Change</option>
                  <option value="breakdown">Breakdown</option>
                  <option value="material_shortage">Material Shortage</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {stoppageForm.reason === 'breakdown' && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    SAP Notification Number *
                  </label>
                  <input
                    type="text"
                    value={stoppageForm.sapNotificationNumber}
                    onChange={(e) => setStoppageForm({...stoppageForm, sapNotificationNumber: e.target.value})}
                    className={`w-full px-3 py-2 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    placeholder="Enter SAP notification number"
                  />
                </div>
              )}

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Duration (minutes) *
                </label>
                <input
                  type="number"
                  value={stoppageForm.duration}
                  onChange={(e) => setStoppageForm({...stoppageForm, duration: parseInt(e.target.value) || 0})}
                  className={`w-full px-3 py-2 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  min="1"
                  max="60"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Description
                </label>
                <textarea
                  value={stoppageForm.description}
                  onChange={(e) => setStoppageForm({...stoppageForm, description: e.target.value})}
                  rows={3}
                  className={`w-full px-3 py-2 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="Optional description"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={handleAddStoppage}
                  disabled={!stoppageForm.reason || !stoppageForm.duration || (stoppageForm.reason === 'breakdown' && !stoppageForm.sapNotificationNumber)}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  <span>Add Stoppage</span>
                </button>
                <button
                  onClick={closeModals}
                  className={`px-4 py-2 rounded ${
                    isDarkMode 
                      ? 'bg-gray-600 text-white hover:bg-gray-700' 
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Production Modal */}
      {showProductionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`rounded-lg w-full max-w-md mx-4 ${
            isDarkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className={`p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Update Production</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Operator
                </label>
                <select
                  value={productionForm.operatorId}
                  onChange={(e) => setProductionForm({...productionForm, operatorId: e.target.value})}
                  className={`w-full px-3 py-2 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="">Select operator</option>
                  {users.map((user) => (
                    <option key={user._id || user.id} value={user._id || user.id}>
                      {user.username}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Mold
                </label>
                <select
                  value={productionForm.moldId}
                  onChange={(e) => setProductionForm({...productionForm, moldId: e.target.value})}
                  className={`w-full px-3 py-2 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="">Select mold</option>
                  {molds.map((mold) => (
                    <option key={mold._id} value={mold._id}>
                      {mold.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Defective Units
                </label>
                <input
                  type="number"
                  value={productionForm.defectiveUnits}
                  onChange={(e) => setProductionForm({...productionForm, defectiveUnits: parseInt(e.target.value) || 0})}
                  className={`w-full px-3 py-2 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  min="0"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="applyToShift"
                  checked={productionForm.applyToShift}
                  onChange={(e) => setProductionForm({...productionForm, applyToShift: e.target.checked})}
                  className="mr-2"
                />
                <label htmlFor="applyToShift" className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Apply operator and mold to entire shift
                </label>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={handleUpdateProduction}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  <Save className="h-4 w-4" />
                  <span>Update</span>
                </button>
                <button
                  onClick={closeModals}
                  className={`px-4 py-2 rounded ${
                    isDarkMode 
                      ? 'bg-gray-600 text-white hover:bg-gray-700' 
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductionTimeline;