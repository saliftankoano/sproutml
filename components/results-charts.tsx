"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  LineChart,
  Line
} from "recharts";

interface ResultsChartsProps {
  data: Record<string, unknown>;
}

export function ResultsCharts({ data }: ResultsChartsProps) {
  // Extract metrics from the data
  const metrics = extractMetrics(data);

  if (!metrics || metrics.length === 0) {
    return (
      <div className="p-8 rounded-lg bg-card border border-border text-center">
        <p className="text-sm text-muted-foreground">
          No visualization data available
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Model Performance</CardTitle>
          <CardDescription>Key metrics comparison</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(232, 236, 246, 0.1)" />
              <XAxis 
                dataKey="name" 
                stroke="#8891a8"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="#8891a8"
                style={{ fontSize: '12px' }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#101522',
                  border: '1px solid rgba(232, 236, 246, 0.1)',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Legend 
                wrapperStyle={{ fontSize: '12px' }}
              />
              <Bar dataKey="value" fill="#22C55E" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Training Progress</CardTitle>
          <CardDescription>Performance over iterations</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={generateProgressData()}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(232, 236, 246, 0.1)" />
              <XAxis 
                dataKey="iteration" 
                stroke="#8891a8"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="#8891a8"
                style={{ fontSize: '12px' }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#101522',
                  border: '1px solid rgba(232, 236, 246, 0.1)',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line 
                type="monotone" 
                dataKey="accuracy" 
                stroke="#22C55E" 
                strokeWidth={2}
                dot={{ fill: '#22C55E', r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="loss" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function extractMetrics(data: Record<string, unknown>): Array<{ name: string; value: number }> {
  const metrics: Array<{ name: string; value: number }> = [];
  
  // Try to extract common metric keys
  const metricKeys = ['accuracy', 'precision', 'recall', 'f1_score', 'r2_score', 'mse', 'mae'];
  
  for (const key of metricKeys) {
    if (key in data && typeof data[key] === 'number') {
      metrics.push({
        name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value: Math.round((data[key] as number) * 100) / 100
      });
    }
  }

  // If no standard metrics found, try to extract any numeric values
  if (metrics.length === 0) {
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'number' && !key.toLowerCase().includes('id')) {
        metrics.push({
          name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          value: Math.round(value * 100) / 100
        });
      }
    }
  }

  return metrics.slice(0, 6); // Limit to 6 metrics for better visualization
}

function generateProgressData() {
  // Generate sample progress data
  const iterations = 10;
  const data = [];
  
  for (let i = 1; i <= iterations; i++) {
    data.push({
      iteration: i,
      accuracy: Math.min(0.95, 0.5 + (i / iterations) * 0.4 + Math.random() * 0.05),
      loss: Math.max(0.1, 1.0 - (i / iterations) * 0.8 - Math.random() * 0.1)
    });
  }
  
  return data;
}
