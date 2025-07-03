'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Shield, 
  Users, 
  Zap,
  TrendingUp,
  Server,
  Database,
  Globe,
  AlertCircle
} from 'lucide-react';

interface DashboardMetrics {
  requests: {
    total: number;
    rate: number;
    success: number;
    blocked: number;
    errors: number;
  };
  latency: {
    avg: number;
    p95: number;
    p99: number;
  };
  evaluations: {
    total: number;
    violations: number;
    rate: number;
  };
  system: {
    cpu: number;
    memory: number;
    connections: number;
    queueSize: number;
  };
  alerts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

interface TimeSeriesData {
  timestamp: number;
  value: number;
}

interface ChartData {
  requests: TimeSeriesData[];
  latency: TimeSeriesData[];
  violations: TimeSeriesData[];
  cpu: TimeSeriesData[];
}

export function RealTimeDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    requests: { total: 0, rate: 0, success: 0, blocked: 0, errors: 0 },
    latency: { avg: 0, p95: 0, p99: 0 },
    evaluations: { total: 0, violations: 0, rate: 0 },
    system: { cpu: 0, memory: 0, connections: 0, queueSize: 0 },
    alerts: { critical: 0, high: 0, medium: 0, low: 0 }
  });

  const [chartData, setChartData] = useState<ChartData>({
    requests: [],
    latency: [],
    violations: [],
    cpu: []
  });

  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Disable WebSocket connection to prevent popups
    // connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const connectWebSocket = () => {
    try {
      const ws = new WebSocket(`ws://${window.location.host}/api/dashboard/stream`);
      
      ws.onopen = () => {
        setIsConnected(true);
        console.log('Dashboard WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleMetricsUpdate(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Attempt to reconnect after 5 seconds
        setTimeout(connectWebSocket, 5000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      // Fallback to polling
      startPolling();
    }
  };

  const startPolling = () => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/dashboard/metrics');
        if (response.ok) {
          const data = await response.json();
          handleMetricsUpdate(data);
        }
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
      }
    }, 5000);

    return () => clearInterval(interval);
  };

  const handleMetricsUpdate = (data: any) => {
    if (data.type === 'metrics') {
      setMetrics(data.metrics);
    } else if (data.type === 'timeseries') {
      setChartData(prev => ({
        requests: [...prev.requests.slice(-29), data.data.requests],
        latency: [...prev.latency.slice(-29), data.data.latency],
        violations: [...prev.violations.slice(-29), data.data.violations],
        cpu: [...prev.cpu.slice(-29), data.data.cpu]
      }));
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const formatLatency = (ms: number): string => {
    if (ms >= 1000) {
      return (ms / 1000).toFixed(2) + 's';
    }
    return ms.toFixed(0) + 'ms';
  };

  const getStatusColor = (value: number, thresholds: { warning: number; critical: number }) => {
    if (value >= thresholds.critical) return 'text-red-600';
    if (value >= thresholds.warning) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">AI Governance Dashboard</h1>
          <p className="text-gray-600 mt-1">Real-time monitoring and analytics</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
            isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span>{isConnected ? 'Live' : 'Disconnected'}</span>
          </div>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Request Rate */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Request Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatNumber(metrics.requests.rate)}/s
              </p>
              <p className="text-sm text-gray-500">
                {formatNumber(metrics.requests.total)} total
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Success Rate */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Success Rate</p>
              <p className="text-2xl font-bold text-green-600">
                {metrics.requests.total > 0 ? 
                  ((metrics.requests.success / metrics.requests.total) * 100).toFixed(1)
                  : '0'
                }%
              </p>
              <p className="text-sm text-gray-500">
                {formatNumber(metrics.requests.blocked)} blocked
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* Average Latency */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Latency</p>
              <p className={`text-2xl font-bold ${getStatusColor(metrics.latency.avg, { warning: 500, critical: 1000 })}`}>
                {formatLatency(metrics.latency.avg)}
              </p>
              <p className="text-sm text-gray-500">
                P95: {formatLatency(metrics.latency.p95)}
              </p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        {/* Violations */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Policy Violations</p>
              <p className="text-2xl font-bold text-red-600">
                {formatNumber(metrics.evaluations.violations)}
              </p>
              <p className="text-sm text-gray-500">
                {formatNumber(metrics.evaluations.rate)}/min rate
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <Shield className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Request Volume Chart */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Request Volume</h3>
            <TrendingUp className="w-5 h-5 text-gray-400" />
          </div>
          <div className="h-48 flex items-end space-x-1">
            {chartData.requests.map((point, index) => {
              const height = Math.max((point.value / Math.max(...chartData.requests.map(p => p.value))) * 100, 2);
              return (
                <div
                  key={index}
                  className="bg-blue-500 rounded-t"
                  style={{ height: `${height}%`, width: '100%' }}
                  title={`${point.value} requests`}
                />
              );
            })}
          </div>
        </div>

        {/* Latency Chart */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Response Latency</h3>
            <Clock className="w-5 h-5 text-gray-400" />
          </div>
          <div className="h-48 flex items-end space-x-1">
            {chartData.latency.map((point, index) => {
              const height = Math.max((point.value / Math.max(...chartData.latency.map(p => p.value))) * 100, 2);
              const color = point.value > 1000 ? 'bg-red-500' : point.value > 500 ? 'bg-yellow-500' : 'bg-green-500';
              return (
                <div
                  key={index}
                  className={`${color} rounded-t`}
                  style={{ height: `${height}%`, width: '100%' }}
                  title={`${formatLatency(point.value)}`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* System Status and Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Health */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">System Health</h3>
            <Server className="w-5 h-5 text-gray-400" />
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>CPU Usage</span>
                <span className={getStatusColor(metrics.system.cpu, { warning: 70, critical: 90 })}>
                  {metrics.system.cpu}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    metrics.system.cpu > 90 ? 'bg-red-500' : 
                    metrics.system.cpu > 70 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${metrics.system.cpu}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Memory Usage</span>
                <span className={getStatusColor(metrics.system.memory, { warning: 80, critical: 95 })}>
                  {metrics.system.memory}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    metrics.system.memory > 95 ? 'bg-red-500' : 
                    metrics.system.memory > 80 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${metrics.system.memory}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <p className="text-xs text-gray-500">Active Connections</p>
                <p className="text-lg font-semibold">{formatNumber(metrics.system.connections)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Queue Size</p>
                <p className="text-lg font-semibold">{formatNumber(metrics.system.queueSize)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Active Alerts */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Active Alerts</h3>
            <AlertTriangle className="w-5 h-5 text-gray-400" />
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-sm">Critical</span>
              </div>
              <span className="text-lg font-semibold text-red-600">
                {metrics.alerts.critical}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                <span className="text-sm">High</span>
              </div>
              <span className="text-lg font-semibold text-orange-600">
                {metrics.alerts.high}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span className="text-sm">Medium</span>
              </div>
              <span className="text-lg font-semibold text-yellow-600">
                {metrics.alerts.medium}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-sm">Low</span>
              </div>
              <span className="text-lg font-semibold text-blue-600">
                {metrics.alerts.low}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
            <Zap className="w-5 h-5 text-gray-400" />
          </div>
          
          <div className="space-y-3">
            <button className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Globe className="w-4 h-4" />
              <span>View Gateway Status</span>
            </button>
            
            <button className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              <Database className="w-4 h-4" />
              <span>Check Data Health</span>
            </button>
            
            <button className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700">
              <AlertCircle className="w-4 h-4" />
              <span>Review Violations</span>
            </button>
            
            <button className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
              <Users className="w-4 h-4" />
              <span>Manage Users</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RealTimeDashboard;