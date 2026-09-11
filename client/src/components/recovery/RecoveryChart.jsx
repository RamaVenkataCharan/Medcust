import React, { useState, useEffect, useRef } from 'react';
import { BarChart3, IndianRupee, Calendar } from 'lucide-react';

const API_BASE = 'http://localhost:4000';

export default function RecoveryChart() {
  const [rateData, setRateData] = useState(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef(null);

  useEffect(() => {
    loadRate();
  }, [days]);

  useEffect(() => {
    if (rateData && canvasRef.current) {
      drawChart();
    }
  }, [rateData]);

  const loadRate = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/recovery/rate?days=${days}`);
      const data = await res.json();
      setRateData(data);
    } catch (err) {
      console.error('Failed to load recovery rate:', err);
    } finally {
      setLoading(false);
    }
  };

  const drawChart = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Set canvas size
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 200 * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = '200px';
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = 200;
    const padding = { top: 20, right: 20, bottom: 35, left: 55 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Clear
    ctx.clearRect(0, 0, width, height);

    const dailyData = rateData?.daily || [];
    if (dailyData.length === 0) {
      ctx.font = '12px system-ui';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText('No recovery data in this period', width / 2, height / 2);
      return;
    }

    const maxRecovered = Math.max(...dailyData.map(d => d.recovered), 100);

    // ── Draw grid lines ──
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
      const y = padding.top + (chartHeight / ySteps) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Y-axis labels
      const value = maxRecovered - (maxRecovered / ySteps) * i;
      ctx.font = '10px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'right';
      ctx.fillText(`₹${Math.round(value).toLocaleString()}`, padding.left - 8, y + 3);
    }

    // ── Draw bars ──
    const barWidth = Math.max(4, (chartWidth / dailyData.length) - 4);

    dailyData.forEach((d, i) => {
      const x = padding.left + (chartWidth / dailyData.length) * i + (chartWidth / dailyData.length) / 2 - barWidth / 2;
      const barHeight = (d.recovered / maxRecovered) * chartHeight;
      const y = padding.top + chartHeight - barHeight;

      // Bar gradient
      const gradient = ctx.createLinearGradient(x, y, x, padding.top + chartHeight);
      gradient.addColorStop(0, '#6366f1');
      gradient.addColorStop(1, '#818cf8');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      // Rounded top corners
      const radius = Math.min(3, barWidth / 2);
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + barWidth - radius, y);
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
      ctx.lineTo(x + barWidth, padding.top + chartHeight);
      ctx.lineTo(x, padding.top + chartHeight);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.fill();

      // X-axis labels (every N days to avoid crowding)
      const showLabel = dailyData.length <= 14 || i % Math.ceil(dailyData.length / 10) === 0;
      if (showLabel) {
        ctx.font = '9px system-ui';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';
        const label = new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
        ctx.fillText(label, x + barWidth / 2, height - 8);
      }
    });

    // ── Draw trend line ──
    if (dailyData.length > 1) {
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();

      dailyData.forEach((d, i) => {
        const x = padding.left + (chartWidth / dailyData.length) * i + (chartWidth / dailyData.length) / 2;
        const y = padding.top + chartHeight - (d.recovered / maxRecovered) * chartHeight;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });

      ctx.stroke();
      ctx.setLineDash([]);
    }
  };

  const summary = rateData?.summary || {};

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-600" />
          <h3 className="text-xs font-bold text-slate-800">Recovery Rate Over Time</h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Summary */}
          <div className="hidden sm:flex items-center gap-4 mr-3">
            <div className="text-right">
              <p className="text-[9px] text-slate-400 uppercase font-bold">Total Recovered</p>
              <p className="text-sm font-bold font-mono text-emerald-700">
                ₹{(summary.total_recovered || 0).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div className="text-right">
              <p className="text-[9px] text-slate-400 uppercase font-bold">Recovery Rate</p>
              <p className="text-sm font-bold font-mono text-indigo-700">{summary.recovery_rate || 0}%</p>
            </div>
          </div>

          {/* Period selector */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
            {[7, 14, 30].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                  days === d
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        {loading ? (
          <div className="h-[200px] flex items-center justify-center">
            <p className="text-xs text-slate-400">Loading chart data...</p>
          </div>
        ) : (
          <canvas ref={canvasRef} />
        )}
      </div>
    </div>
  );
}
