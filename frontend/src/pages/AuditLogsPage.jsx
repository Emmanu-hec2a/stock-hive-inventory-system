import { useEffect, useState } from "react";
import api from "../api/client";
import FeatureGate from "../components/FeatureGate";
import { useAuth } from "../state/AuthContext";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");
  const { user } = useAuth();

  const loadLogs = async () => {
    try {
      const response = await api.get("/audit-logs/");
      setLogs(response.data);
      setError("");
    } catch (err) {
      setError("Could not load audit logs.");
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <section>
      <h1 className="page-title">Activity Audit Trail</h1>

      <FeatureGate feature="audit_logs">
          {error && <div className="alert-bar">⚠ {error}</div>}

          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Model</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontSize: '0.85rem' }}>
                        {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td>
                        <div style={{ fontWeight: 'bold' }}>{log.user_name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#666' }}>{log.shop_name || 'System Wide'}</div>
                    </td>
                    <td>
                      <span className={`pill ${
                        log.action === 'create' ? 'pill-green' :
                        log.action === 'update' ? 'pill-amber' : 'pill-red'
                      }`}>
                        {log.action.toUpperCase()}
                      </span>
                    </td>
                    <td>{log.model_name}</td>
                    <td>
                        {log.changes ? (
                            <pre style={{ fontSize: '0.75rem', margin: 0 }}>
                                {JSON.stringify(log.changes, null, 2)}
                            </pre>
                        ) : (
                            <span style={{ fontSize: '0.75rem', color: '#999' }}>ID: {log.target_id.split('-')[0]}...</span>
                        )}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                    <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>
                            No activity logs found.
                        </td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>
      </FeatureGate>
    </section>
  );
}
