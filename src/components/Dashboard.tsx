import React, { useEffect, useState } from 'react';
import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ThemeContext } from '../App';
import { Department } from '../types';
import apiService from '../services/api';
import socketService from '../services/socket';
import { 
  Building2, 
  Activity, 
  TrendingUp, 
  AlertTriangle,
  Users,
  Gauge
} from 'lucide-react';

const Dashboard: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [factoryStats, setFactoryStats] = useState({
    totalUnits: 0,
    avgOEE: 0,
    unclassifiedStoppages: 0,
    activeMachines: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user, isOperator } = useAuth();
  const { isDarkMode } = useContext(ThemeContext);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDepartments();
    fetchFactoryStats();
    setupSocketListeners();
  }, []);

  const setupSocketListeners = () => {
    socketService.connect();

    const handleProductionUpdate = () => {
      fetchFactoryStats();
    };

    const handleStoppageUpdate = () => {
      fetchFactoryStats();
    };

    const handleMachineStateUpdate = () => {
      fetchFactoryStats();
    };

    socketService.on('production-update', handleProductionUpdate);
    socketService.on('stoppage-added', handleStoppageUpdate);
    socketService.on('unclassified-stoppage-detected', handleStoppageUpdate);
    socketService.on('machine-state-update', handleMachineStateUpdate);

    return () => {
      socketService.off('production-update', handleProductionUpdate);
      socketService.off('stoppage-added', handleStoppageUpdate);
      socketService.off('unclassified-stoppage-detected', handleStoppageUpdate);
      socketService.off('machine-state-update', handleMachineStateUpdate);
    };
  };

  const fetchDepartments = async () => {
    try {
      const data = await apiService.getDepartments();
      setDepartments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch departments');
    } finally {
      setLoading(false);
    }
  };

  const fetchFactoryStats = async () => {
    try {
      // Get all machines and their stats
      const machines = await apiService.getMachines();
      let totalUnits = 0;
      let totalOEE = 0;
      let activeMachines = 0;

      // Get stats for each machine
      const statsPromises = machines.map((machine: any) => 
        apiService.getMachineStats(machine._id, '24h').catch(() => null)
      );
      
      const allStats = await Promise.all(statsPromises);
      
      allStats.forEach((stats, index) => {
        if (stats) {
          totalUnits += stats.totalUnitsProduced;
          totalOEE += stats.oee;
          if (machines[index].status === 'running') {
            activeMachines++;
          }
        }
      });

      // Get unclassified stoppages count
      const unclassifiedResponse = await fetch('http://localhost:3001/api/signals/unclassified-stoppages-count', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const unclassifiedData = await unclassifiedResponse.json();

      setFactoryStats({
        totalUnits,
        avgOEE: machines.length > 0 ? Math.round(totalOEE / machines.length) : 0,
        unclassifiedStoppages: unclassifiedData.count || 0,
        activeMachines
      });
    } catch (err) {
      console.error('Failed to fetch factory stats:', err);
    }
  };

  const handleDepartmentClick = (departmentId: string) => {
    navigate(`/department/${departmentId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/50 border border-red-500 text-red-300 px-4 py-3 rounded-md">
        <div className="flex items-center">
          <AlertTriangle className="h-4 w-4 mr-2" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${isDarkMode ? '' : 'text-gray-900'}`}>
      {/* Welcome Header */}
      <div className={`bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white ${isDarkMode ? '' : 'shadow-lg'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {user?.username}</h1>
            <p className="text-blue-100 mt-1">
              {isOperator 
                ? `Monitoring ${user?.department?.name || 'your department'}`
                : 'System overview and management'
              }
            </p>
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center space-x-2 text-blue-100">
              <Users className="h-5 w-5" />
              <span className="capitalize">{user?.role}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`p-6 rounded-lg border ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200 shadow-sm'
        }`}>
          <div className="flex items-center">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Departments</p>
              <p className={`text-2xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{departments.length}</p>
            </div>
          </div>
        </div>

        <div className={`p-6 rounded-lg border ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200 shadow-sm'
        }`}>
          <div className="flex items-center">
            <div className="p-2 bg-green-600 rounded-lg">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Active Machines</p>
              <p className={`text-2xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {departments.reduce((total, dept) => total + dept.machineCount, 0)}
              </p>
            </div>
          </div>
        </div>

        <div className={`p-6 rounded-lg border ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200 shadow-sm'
        }`}>
          <div className="flex items-center">
            <div className="p-2 bg-yellow-600 rounded-lg">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Avg OEE</p>
              <p className={`text-2xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{factoryStats.avgOEE}%</p>
            </div>
          </div>
        </div>

        <div className={`p-6 rounded-lg border ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200 shadow-sm'
        }`}>
          <div className="flex items-center">
            <div className="p-2 bg-red-600 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Unclassified Stoppages</p>
              <p className={`text-2xl font-semibold ${factoryStats.unclassifiedStoppages > 0 ? 'text-red-400 animate-pulse' : (isDarkMode ? 'text-white' : 'text-gray-900')}`}>
                {factoryStats.unclassifiedStoppages}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Departments Grid */}
      <div>
        <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          {isOperator ? 'Your Department' : 'Departments Overview'}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map((department) => (
            <div
              key={department._id}
              onClick={() => handleDepartmentClick(department._id)}
              className={`rounded-lg border cursor-pointer transition-all duration-200 ${
                isDarkMode 
                  ? 'bg-gray-800 border-gray-700 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/20' 
                  : 'bg-white border-gray-200 hover:border-blue-500 hover:shadow-lg shadow-sm'
              }`}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{department.name}</h3>
                  <Building2 className="h-6 w-6 text-blue-400" />
                </div>
                
                <p className={`text-sm mb-4 line-clamp-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {department.description || 'No description available'}
                </p>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Machines</span>
                    <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {department.machineCount || 0}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Status</span>
                    <div className="flex items-center space-x-2">
                      <div className="h-2 w-2 bg-green-400 rounded-full"></div>
                      <span className="text-green-400 text-sm">Active</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>OEE</span>
                    <div className="flex items-center space-x-1">
                      <Gauge className="h-4 w-4 text-yellow-400" />
                      <span className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{departmentStats.avgOEE}%</span>
                    </div>
                  </div>
                </div>

                <div className={`mt-4 pt-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <button className="w-full text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors">
                    View Details →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {departments.length === 0 && (
          <div className="text-center py-12">
            <Building2 className={`h-12 w-12 mx-auto mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
            <h3 className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>No departments found</h3>
            <p className={isDarkMode ? 'text-gray-500' : 'text-gray-600'}>
              {isOperator 
                ? 'You have not been assigned to any department yet.'
                : 'Get started by creating your first department.'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;