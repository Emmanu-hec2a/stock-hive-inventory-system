import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Colors for charts
const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];

export function SalesLineChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="chart-empty">No data available</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip formatter={(value) => `KES ${value.toLocaleString()}`} />
        <Legend />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="#3b82f6"
          name="Revenue"
          strokeWidth={2}
        />
        <Line
          type="monotone"
          dataKey="transactions"
          stroke="#10b981"
          name="Transactions"
          yAxisId="right"
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function PaymentMethodChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="chart-empty">No data available</div>;
  }

  const chartData = data.map((item) => ({
    name: item.method,
    value: item.total_amount,
    count: item.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, value }) =>
            `${name}: KES ${(value / 1000).toFixed(0)}k`
          }
          outerRadius={100}
          fill="#8884d8"
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => `KES ${value.toLocaleString()}`} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TopProductsChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="chart-empty">No data available</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
        <YAxis yAxisId="left" label={{ value: "Revenue (KES)", angle: -90, position: "insideLeft" }} />
        <YAxis
          yAxisId="right"
          orientation="right"
          label={{ value: "Quantity Sold", angle: 90, position: "insideRight" }}
        />
        <Tooltip formatter={(value) => value.toLocaleString()} />
        <Legend />
        <Bar yAxisId="left" dataKey="revenue" fill="#3b82f6" name="Revenue" />
        <Bar
          yAxisId="right"
          dataKey="quantity_sold"
          fill="#10b981"
          name="Quantity Sold"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CategoryPerformanceChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="chart-empty">No data available</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="category" angle={-45} textAnchor="end" height={100} />
        <YAxis />
        <Tooltip formatter={(value) => value.toLocaleString()} />
        <Legend />
        <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" />
        <Bar dataKey="quantity_sold" fill="#10b981" name="Quantity Sold" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StaffPerformanceChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="chart-empty">No data available</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
        <YAxis />
        <Tooltip formatter={(value) => value.toLocaleString()} />
        <Legend />
        <Bar dataKey="total_sales" fill="#3b82f6" name="Total Sales" />
        <Bar dataKey="transaction_count" fill="#10b981" name="Transactions" />
      </BarChart>
    </ResponsiveContainer>
  );
}
