import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Department, Machine, MachineStats, MachineStatus } from '../types';
import apiService from '../services/api';
import { useAuth } from '../context/AuthContext';
import socketService from '../services/socket';

import {
  ArrowLeft,
  Settings,
  Activity,
  Plus,
  Edit,
  Power,
  Gauge,
  Trash2,
  Save,
  X,
  AlertTriangle
} from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const DepartmentView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [department, setDepartment] = useState<Department | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingMachine, setIsAddingMachine] = useState(false);
  const [newMachine, setNewMachine] = useState<{
    name: string;
    description: string;
    status: Machine['status'];
  }>({
    name: '',
    description: '',
    status: 'inactive'
  });
  const [editLayoutMode, setEditLayoutMode] = useState(false);
  const [positions, setPositions] = useState<{[key: string]: {x: number; y: number}}>({});
  const [draggingMachineId, setDraggingMachineId] = useState<string | null>(null);
  const [machineStatuses, setMachineStatuses] = useState<{[key: string]: string}>({});
  const layoutContainerRef = useRef<HTMLDivElement>(null);
  const [machineStats, setMachineStats] = useState<{[machineId: string]: MachineStats}>({});
  const dragOffset = useRef({ x: 0, y: 0 });
  const machinesRef = useRef<Machine[]>([]);
  machinesRef.current = machines;

  // Calculate department stats from machine data
  const departmentStats = useMemo(() => {
    let totalUnits = 0;
    let totalOEE = 0;
    let runningMachines = 0;
    let stoppedMachines = 0;
    let machinesWithStats = 0;

    machines.forEach(machine => {
      // Count machine states
      if (machine.status === 'running') {
        runningMachines++;
      } else {
        stoppedMachines++;
      }

      // Aggregate stats if available
      if (machineStats[machine._id]) {
        const stats = machineStats[machine._id];
        totalUnits += stats.totalUnitsProduced || 0;
        totalOEE += stats.oee || 0;
        machinesWithStats++;
      }
    });

    // Calculate average OEE
    const avgOEE = machinesWithStats > 0 
      ? Math.round(totalOEE / machinesWithStats) 
      : 0;

    return {
      totalUnits,
      avgOEE,
      runningMachines,
      stoppedMachines
    };
  }, [machines, machineStats]);

  useEffect(() => {
    if (id) {
      fetchDepartmentData();
      setupSocketListeners();
    }
    
    return () => {
      socketService.off('machine-state-update');
      socketService.off('production-update');
      socketService.off('stoppage-added');
      socketService.off('unclassified-stoppage-detected');
    };
  }, [id]);

  const setupSocketListeners = () => {
    const handleMachineStateUpdate = (update: any) => {
      const machine = machinesRef.current.find(m => m._id === update.machineId);
      if (machine) {
        setMachineStatuses(prev => ({
          ...prev,
          [update.machineId]: update.status
        }));
        
        setMachines(prevMachines => 
          prevMachines.map(m => 
            m._id === update.machineId 
              ? { ...m, status: update.dbStatus }
              : m
          )
        );
      }
    };

    const handleProductionUpdate = (update: any) => {
      const machine = machinesRef.current.find(m => m._id === update.machineId);
      if (machine) {
        fetchMachineStatsForMachine(update.machineId);
      }
    };

    const handleStoppageUpdate = (update: any) => {
      const machine = machinesRef.current.find(m => m._id === update.machineId);
      if (machine) {
        fetchMachineStatsForMachine(update.machineId);
      }
    };

    socketService.on('machine-state-update', handleMachineStateUpdate);
    socketService.on('production-update', handleProductionUpdate);
    socketService.on('stoppage-added', handleStoppageUpdate);
    socketService.on('unclassified-stoppage-detected', handleStoppageUpdate);

    return () => {
      socketService.off('machine-state-update', handleMachineStateUpdate);
      socketService.off('production-update', handleProductionUpdate);
      socketService.off('stoppage-added', handleStoppageUpdate);
      socketService.off('unclassified-stoppage-detected', handleStoppageUpdate);
    };
  };

  const fetchDepartmentData = async () => {
    try {
      setLoading(true);
      const deptData = await apiService.getDepartment(id!);
      setDepartment(deptData);
      setMachines(deptData.machines || []);
      
      const initialPositions: {[key: string]: {x: number; y: number}} = {};
      deptData.machines?.forEach((machine: Machine) => {
        initialPositions[machine._id] = { ...machine.position };
      });

      setPositions(initialPositions);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch department data';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMachineStatsForMachine = async (machineId: string) => {
    try {
      const stats = await apiService.getMachineStats(machineId, '24h');
      setMachineStats(prev => ({
        ...prev,
        [machineId]: stats
      }));
    } catch (error) {
      console.error(`Failed to fetch stats for machine ${machineId}:`, error);
    }
  };

  const fetchMachineStats = async () => {
    try {
      const stats: {[machineId: string]: MachineStats} = {};
      for (const machine of machines) {
        const machineStats = await apiService.getMachineStats(machine._id, '24h');
        stats[machine._id] = machineStats;
      }
      setMachineStats(stats);
    } catch (error) {
      console.error('Failed to fetch machine stats:', error);
    }
  };

  useEffect(() => {
    if (machines.length > 0) {
      fetchMachineStats();
    }
  }, [machines]);

  const handleMachineClick = (machineId: string) => {
    if (!editLayoutMode) {
      navigate(`/machine/${machineId}`);
    }
  };

  const getStatusColor = (status: MachineStatus) => {
    switch (status) {
      case 'running': return 'bg-green-500';
      case 'stoppage': return 'bg-red-500 animate-pulse';
      case 'stopped_yet_producing': return 'bg-orange-500';
      case 'inactive': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: MachineStatus) => {
    switch (status) {
      case 'running': return 'Running';
      case 'stoppage': return 'Stoppage';
      case 'stopped_yet_producing': return 'Stopped Yet Producing';
      case 'inactive': return 'Inactive';
      default: return status;
    }
  };

  const handleAddMachine = async () => {
    try {
      const createdMachine = await apiService.createMachine({
        ...newMachine,
        departmentId: id
      });
      
      setMachines([...machines, createdMachine]);
      setPositions({
        ...positions,
        [createdMachine._id]: createdMachine.position
      });
      setIsAddingMachine(false);
      setNewMachine({
        name: '',
        description: '',
        status: 'inactive'
      });
      toast.success('Machine added successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add machine';
      toast.error(message);
    }
  };

  const handleDeleteMachine = async (machineId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to permanently delete this machine? All associated data will be lost.')) {
      try {
        await apiService.deleteMachine(machineId);
        setMachines(machines.filter(m => m._id !== machineId));
        
        if (draggingMachineId === machineId) {
          setDraggingMachineId(null);
        }
        toast.success('Machine deleted successfully');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete machine';
        toast.error(message);
      }
    }
  };

  const handleMouseDown = (machineId: string, e: React.MouseEvent) => {
    if (!editLayoutMode || !layoutContainerRef.current) return;
    e.stopPropagation();
    
    const containerRect = layoutContainerRef.current.getBoundingClientRect();
    const machineX = positions[machineId]?.x || 0;
    const machineY = positions[machineId]?.y || 0;
    
    dragOffset.current = {
      x: e.clientX - containerRect.left - machineX,
      y: e.clientY - containerRect.top - machineY
    };
    
    setDraggingMachineId(machineId);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!editLayoutMode || !draggingMachineId || !layoutContainerRef.current) return;
    
    const containerRect = layoutContainerRef.current.getBoundingClientRect();
    const x = e.clientX - containerRect.left - dragOffset.current.x;
    const y = e.clientY - containerRect.top - dragOffset.current.y;
    
    const boundedX = Math.max(10, Math.min(x, containerRect.width - 210));
    const boundedY = Math.max(10, Math.min(y, containerRect.height - 210));
    
    setPositions(prev => ({
      ...prev,
      [draggingMachineId]: { x: boundedX, y: boundedY }
    }));
  };

  const handleMouseUp = async () => {
    if (!editLayoutMode || !draggingMachineId) return;
    
    if (!machines.some(m => m._id === draggingMachineId)) {
      setDraggingMachineId(null);
      return;
    }

    try {
      await apiService.updateMachinePosition(
        draggingMachineId, 
        positions[draggingMachineId]
      );
      toast.success('Machine position updated');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update machine position';
      toast.error(message);
    } finally {
      setDraggingMachineId(null);
    }
  };

  const handleSaveLayout = async () => {
    try {
      const validPositions = Object.keys(positions)
        .filter(machineId => machines.some(m => m._id === machineId))
        .reduce((acc, machineId) => {
          acc[machineId] = positions[machineId];
          return acc;
        }, {} as {[key: string]: {x: number; y: number}});

      await Promise.all(
        Object.entries(validPositions).map(([machineId, position]) => 
          apiService.updateMachinePosition(machineId, position)
        )
      );
      setEditLayoutMode(false);
      toast.success('Layout saved successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save layout';
      toast.error(message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!department) {
    return (
      <div className="text-center py-12">
        <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Department not found</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${isDarkMode ? '' : 'min-h-screen bg-gray-50'}`}>
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
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/dashboard')}
            className={`p-2 rounded-md transition-colors ${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{department.name}</h1>
            <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>{department.description}</p>
          </div>
        </div>
        
        {isAdmin && (
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setIsAddingMachine(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add Machine</span>
            </button>
            <button 
              onClick={() => setEditLayoutMode(!editLayoutMode)}
              className={`p-2 rounded-md transition-colors ${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
            >
              {editLayoutMode ? <Save className="h-5 w-5" /> : <Settings className="h-5 w-5" />}
            </button>
          </div>
        )}
      </div>

      {/* Department Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`p-4 rounded-lg border ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200 shadow-sm'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Machines</p>
              <p className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{machines.length}</p>
            </div>
            <Activity className="h-8 w-8 text-blue-400" />
          </div>
        </div>

        <div className={`p-4 rounded-lg border ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200 shadow-sm'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Running</p>
              <p className="text-xl font-semibold text-green-400">{departmentStats.runningMachines}</p>
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
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Stopped</p>
              <p className="text-xl font-semibold text-red-400">{departmentStats.stoppedMachines}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-400" />
          </div>
        </div>

        <div className={`p-4 rounded-lg border ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200 shadow-sm'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Department OEE</p>
              <p className="text-xl font-semibold text-yellow-400">{departmentStats.avgOEE}%</p>
            </div>
            <Gauge className="h-8 w-8 text-yellow-400" />
          </div>
        </div>
      </div>

      {/* Machine Layout */}
      <div className={`rounded-lg border ${
        isDarkMode 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-200 shadow-sm'
      }`}>
        <div className={`p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Machine Layout</h2>
            {isAdmin && (
              <button 
                onClick={() => setEditLayoutMode(!editLayoutMode)}
                className={`text-sm flex items-center space-x-1 ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
              >
                <Edit className="h-4 w-4" />
                <span>{editLayoutMode ? 'Save Layout' : 'Edit Layout'}</span>
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          {machines.length > 0 ? (
            <div 
              ref={layoutContainerRef}
              className={`relative w-full min-h-[700px] rounded-lg border border-dashed ${
                isDarkMode 
                  ? 'bg-gray-900/50 border-gray-700' 
                  : 'bg-gray-100/50 border-gray-300'
              }`}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {machines.map((machine) => (
                <div
                  key={machine._id}
                  onClick={() => handleMachineClick(machine._id)}
                  className={`absolute rounded-lg p-4 border ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600' 
                      : 'bg-white border-gray-300'
                  } ${
                    editLayoutMode 
                      ? 'border-blue-500 cursor-move' 
                      : 'hover:border-blue-500'
                  } transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/10`}
                  style={{
                    left: `${positions[machine._id]?.x || 0}px`,
                    top: `${positions[machine._id]?.y || 0}px`,
                    width: '200px',
                    zIndex: draggingMachineId === machine._id ? 10 : 1,
                    cursor: editLayoutMode ? 'move' : 'pointer',
                    transform: draggingMachineId === machine._id ? 'scale(1.02)' : 'none',
                    transition: draggingMachineId === machine._id ? 'none' : 'all 0.2s ease',
                    boxShadow: draggingMachineId === machine._id ? '0 10px 25px rgba(0, 0, 0, 0.3)' : 'none'
                  }}
                  onMouseDown={(e) => handleMouseDown(machine._id, e)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className={`font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{machine.name}</h3>
                    <div className="flex items-center space-x-2">
                      <div className={`h-3 w-3 rounded-full ${getStatusColor(machineStatuses[machine._id] as MachineStatus || machine.status as MachineStatus)}`}></div>
                      {editLayoutMode && (
                        <button
                          onClick={(e) => handleDeleteMachine(machine._id, e)}
                          className="text-red-400 hover:text-red-300 p-1 rounded-md hover:bg-gray-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <p className={`text-sm mb-3 line-clamp-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {machine.description || 'No description'}
                  </p>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Status</span>
                        <span className={`font-medium ${
                          (machineStatuses[machine._id] || machine.status) === 'running' 
                            ? 'text-green-400' :
                          (machineStatuses[machine._id] || machine.status) === 'stoppage' 
                            ? 'text-red-400' :
                          (machineStatuses[machine._id] || machine.status) === 'stopped_yet_producing' 
                            ? 'text-orange-400' :
                          'text-gray-400' // inactive
                        }`}>
                        {getStatusText(machineStatuses[machine._id] as MachineStatus || machine.status as MachineStatus)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>OEE</span>
                      <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {machineStats[machine._id]?.oee ?? 'N/A'}%
                      </span>
                    </div>

                   <div className="flex items-center justify-between text-sm">
                    <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Today's Units</span>
                    <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {machineStats[machine._id]?.totalUnitsProduced ?? 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Activity className={`h-12 w-12 mx-auto mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
              <h3 className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>No machines found</h3>
              <p className={`mb-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                This department doesn't have any machines configured yet.
              </p>
              {isAdmin && (
                <button 
                  onClick={() => setIsAddingMachine(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Add First Machine
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Machine Modal */}
      {isAddingMachine && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className={`rounded-lg border w-full max-w-md ${
            isDarkMode 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200'
          }`}>
            <div className={`p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Add New Machine</h3>
                <button 
                  onClick={() => setIsAddingMachine(false)}
                  className={isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Machine Name *
                </label>
                <input
                  type="text"
                  required
                  className={`w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  value={newMachine.name}
                  onChange={(e) => setNewMachine({...newMachine, name: e.target.value})}
                />
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Description
                </label>
                <textarea
                  rows={3}
                  className={`w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  value={newMachine.description}
                  onChange={(e) => setNewMachine({...newMachine, description: e.target.value})}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Initial Status
                </label>
                <select
                  className={`w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  value={newMachine.status}
                  onChange={(e) => setNewMachine({...newMachine, status: e.target.value as any})}
                >
                  <option value="running">Running</option>
                  <option value="stopped">Stopped</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="error">Error</option>
                </select>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setIsAddingMachine(false)}
                  className={`px-4 py-2 border rounded-md ${
                    isDarkMode 
                      ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddMachine}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add Machine
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Layout Controls */}
      {editLayoutMode && (
        <div className={`rounded-lg border p-4 flex justify-between items-center ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200 shadow-sm'
        }`}>
          <div className={isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}>
            <p className="flex items-center">
              <Edit className="h-4 w-4 mr-2" />
              <span>Layout Edit Mode: Drag machines to reposition, click trash icon to delete</span>
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setEditLayoutMode(false)}
              className={`px-4 py-2 border rounded-md ${
                isDarkMode 
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveLayout}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Layout
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentView;