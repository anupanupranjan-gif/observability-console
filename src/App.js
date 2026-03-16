import { useState, useEffect, useCallback } from "react";

const MCP_BASE = process.env.REACT_APP_MCP_BASE || "http://localhost:3001";
const OLLAMA_BASE = process.env.REACT_APP_OLLAMA_BASE || "http://localhost:11434";
const OLLAMA_MODEL = "gemma3:1b";
const REFRESH_INTERVAL = 30000;

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');

  :root {
    --bg: #0a0e13;
    --bg2: #0f1520;
    --bg3: #141c2a;
    --border: #1e2d40;
    --border2: #2a3f58;
    --text: #c8d8e8;
    --text2: #6a8aaa;
    --text3: #3a5570;
    --amber: #ffb347;
    --amber2: #ff8c00;
    --green: #39ff8f;
    --green2: #00c45a;
    --red: #ff4455;
    --red2: #cc2233;
    --blue: #4499ff;
    --cyan: #00d4ff;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'IBM Plex Mono', monospace;
    min-height: 100vh;
    overflow-x: hidden;
  }

  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0,0,0,0.03) 2px,
      rgba(0,0,0,0.03) 4px
    );
    pointer-events: none;
    z-index: 9999;
  }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }

  input:focus { outline: none; }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  @keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes pulse-green {
    0%, 100% { box-shadow: 0 0 4px var(--green2); }
    50% { box-shadow: 0 0 12px var(--green); }
  }

  @keyframes pulse-red {
    0%, 100% { box-shadow: 0 0 4px var(--red2); }
    50% { box-shadow: 0 0 12px var(--red); }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @keyframes scanline {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(100vh); }
  }

  .metric-card {
    animation: fadeSlideIn 0.3s ease both;
  }

  .chat-message {
    animation: fadeSlideIn 0.2s ease both;
  }
`;

function StatusDot({ status }) {
  const colors = {
    healthy: "var(--green)",
    warning: "var(--amber)",
    critical: "var(--red)",
    degraded: "var(--amber)",
    unknown: "var(--text3)",
    up: "var(--green)",
    down: "var(--red)",
  };
  const color = colors[status] || "var(--text3)";
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: color,
      boxShadow: `0 0 6px ${color}`,
      animation: status === "healthy" || status === "up" ? "pulse-green 2s infinite" : 
                 status === "critical" || status === "down" ? "pulse-red 2s infinite" : "none",
      flexShrink: 0,
    }} />
  );
}

function MetricCard({ title, value, unit, status, detail, delay = 0 }) {
  const statusColors = {
    healthy: "var(--green)",
    warning: "var(--amber)",
    critical: "var(--red)",
    unknown: "var(--text3)",
  };
  const accent = statusColors[status] || "var(--text3)";

  return (
    <div className="metric-card" style={{
      background: "var(--bg2)",
      border: `1px solid var(--border)`,
      borderTop: `2px solid ${accent}`,
      borderRadius: 4,
      padding: "20px 24px",
      animationDelay: `${delay}ms`,
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, right: 0, bottom: 0,
        width: 2, background: `linear-gradient(to bottom, ${accent}33, transparent)`,
      }} />

      <div style={{ fontSize: 10, color: "var(--text3)", letterSpacing: 2, marginBottom: 12, textTransform: "uppercase" }}>
        {title}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 32, fontWeight: 600, color: accent, letterSpacing: -1, lineHeight: 1 }}>
          {value ?? <span style={{ fontSize: 20, color: "var(--text3)" }}>N/A</span>}
        </span>
        {unit && value !== null && value !== undefined && (
          <span style={{ fontSize: 12, color: "var(--text2)" }}>{unit}</span>
        )}
      </div>

      {detail && (
        <div style={{ fontSize: 11, color: "var(--text2)", lineHeight: 1.5 }}>{detail}</div>
      )}

      {status && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
          <StatusDot status={status} />
          <span style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1 }}>
            {status}
          </span>
        </div>
      )}
    </div>
  );
}

function PodHealthCard({ pods, delay = 0 }) {
  return (
    <div className="metric-card" style={{
      background: "var(--bg2)", border: "1px solid var(--border)",
      borderTop: "2px solid var(--cyan)", borderRadius: 4, padding: "20px 24px",
      animationDelay: `${delay}ms`,
    }}>
      <div style={{ fontSize: 10, color: "var(--text3)", letterSpacing: 2, marginBottom: 12, textTransform: "uppercase" }}>
        Pod Health
      </div>
      {!pods || pods.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text3)" }}>No pod data</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {pods.map((pod, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <StatusDot status={pod.status} />
              <div>
                <div style={{ fontSize: 12, color: "var(--text)", fontWeight: 500 }}>
                  {pod.pod?.split("-").slice(-2).join("-")}
                </div>
                <div style={{ fontSize: 10, color: "var(--text3)" }}>{pod.instance}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ThroughputSparkline({ points }) {
  if (!points || points.length < 2) {
    return (
      <div style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 11, color: "var(--text3)" }}>No trend data</span>
      </div>
    );
  }

  const max = Math.max(...points.map(p => p.rpm), 1);
  const width = 400;
  const height = 60;
  const pts = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - (p.rpm / max) * height * 0.85 - 5;
    return `${x},${y}`;
  });
  const pathD = `M ${pts.join(" L ")}`;
  const areaD = `M 0,${height} L ${pts.join(" L ")} L ${width},${height} Z`;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--amber)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--amber)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#sparkGrad)" />
      <path d={pathD} fill="none" stroke="var(--amber)" strokeWidth="1.5" />
    </svg>
  );
}

function ChatPanel({ summary, trendPoints }) {
  const [messages, setMessages] = useState([{
    role: "assistant",
    content: "System online. I have real-time access to SearchX metrics. Ask me anything about the current state of the platform.",
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useState(null)[0];

  const buildSystemPrompt = () => {
    if (!summary) return "You are an observability assistant. No metrics data is available yet.";
    return `You are an AI observability assistant for SearchX, an e-commerce search platform.
You have access to real-time metrics pulled from Prometheus. Here is the current system state:

TIMESTAMP: ${summary.timestamp}
OVERALL STATUS: ${summary.overall_status?.toUpperCase()}

SEARCH TRAFFIC:
- Request rate: ${summary.search_rate?.value ?? "N/A"} requests/minute
- ${summary.search_rate?.description}

LATENCY:
- Average: ${summary.latency?.avg_ms ?? "N/A"}ms
- Max: ${summary.latency?.max_ms ?? "N/A"}ms
- Status: ${summary.latency?.status}

ERROR RATE:
- ${summary.error_rate?.value ?? "N/A"}% errors
- Status: ${summary.error_rate?.status}

POD HEALTH:
- ${summary.pod_health?.description}
- Pods: ${summary.pod_health?.pods?.map(p => `${p.pod} (${p.status})`).join(", ")}

THROUGHPUT TREND (last 30 min): ${trendPoints?.length > 0 
  ? `${trendPoints.length} data points, peak ${Math.max(...trendPoints.map(p => p.rpm)).toFixed(1)} rpm`
  : "No trend data available"}

Answer questions about this system concisely and technically. If asked about things outside these metrics, say so. Keep responses under 3 sentences unless asked for detail.`;
  };

  const sendMessage = async (text) => {
    if (!text?.trim() || loading) return;
    const userMsg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const history = newMessages
        .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n");
      const prompt = `${buildSystemPrompt()}\n\nConversation:\n${history}\nAssistant:`;

      const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt,
          stream: false,
          options: { temperature: 0.3, num_predict: 300 },
        }),
      });

      if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
      const data = await res.json();
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.response?.trim() || "No response generated.",
      }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `⚠ ${e.message.includes("fetch") ? "Cannot reach Ollama at " + OLLAMA_BASE : e.message}`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const SUGGESTED = [
    "Is the system healthy?",
    "What's the current latency?",
    "How much traffic are we getting?",
    "Are all pods running?",
  ];

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 4,
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 20px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--amber)", letterSpacing: 2, textTransform: "uppercase" }}>
            ◈ AI Console
          </div>
          <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>
            {OLLAMA_MODEL} · local · prometheus context
          </div>
        </div>
        <div style={{
          fontSize: 10, color: summary?.overall_status === "healthy" ? "var(--green)" : "var(--amber)",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <StatusDot status={summary?.overall_status || "unknown"} />
          {summary?.overall_status?.toUpperCase() || "CONNECTING"}
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: "auto", padding: 16,
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        {messages.map((msg, i) => (
          <div key={i} className="chat-message" style={{
            display: "flex",
            justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
          }}>
            {msg.role === "assistant" && (
              <div style={{
                width: 20, height: 20, borderRadius: 2,
                background: "var(--amber2)", color: "var(--bg)",
                fontSize: 10, fontWeight: 700, display: "flex",
                alignItems: "center", justifyContent: "center",
                flexShrink: 0, marginRight: 8, marginTop: 2,
              }}>◈</div>
            )}
            <div style={{
              maxWidth: "80%",
              background: msg.role === "user" ? "var(--bg3)" : "transparent",
              border: msg.role === "user" ? "1px solid var(--border2)" : "none",
              borderRadius: 4, padding: msg.role === "user" ? "8px 12px" : "2px 0",
              fontSize: 12, lineHeight: 1.7, color: "var(--text)",
              fontFamily: "'IBM Plex Mono', monospace",
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{
              width: 20, height: 20, borderRadius: 2,
              background: "var(--amber2)", color: "var(--bg)",
              fontSize: 10, fontWeight: 700, display: "flex",
              alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>◈</div>
            <div style={{ display: "flex", gap: 4 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: "var(--amber)",
                  animation: `blink 1s ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Suggested prompts */}
      {messages.length <= 1 && (
        <div style={{ padding: "0 16px 12px", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {SUGGESTED.map(s => (
            <button key={s} onClick={() => sendMessage(s)} style={{
              background: "var(--bg3)", border: "1px solid var(--border2)",
              borderRadius: 3, padding: "4px 10px", fontSize: 10,
              color: "var(--text2)", cursor: "pointer",
              fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 0.3,
              transition: "border-color 0.15s",
            }}>{s}</button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: "12px 16px", borderTop: "1px solid var(--border)",
        display: "flex", gap: 8,
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
          placeholder="Query the system..."
          style={{
            flex: 1, background: "var(--bg3)", border: "1px solid var(--border2)",
            borderRadius: 3, padding: "9px 12px", color: "var(--text)",
            fontSize: 12, fontFamily: "'IBM Plex Mono', monospace",
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          style={{
            background: loading || !input.trim() ? "var(--bg3)" : "var(--amber2)",
            border: "1px solid var(--border2)", borderRadius: 3,
            padding: "9px 14px", cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            color: loading || !input.trim() ? "var(--text3)" : "var(--bg)",
            fontSize: 13, fontWeight: 700, transition: "all 0.15s",
            fontFamily: "'IBM Plex Mono', monospace",
          }}
        >↑</button>
      </div>
    </div>
  );
}

export default function App() {
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const [summaryRes, trendRes] = await Promise.all([
        fetch(`${MCP_BASE}/tools/summary`).then(r => r.json()),
        fetch(`${MCP_BASE}/tools/throughput_trend`).then(r => r.json()),
      ]);
      setSummary(summaryRes);
      setTrend(trendRes.points || []);
      setLastUpdated(new Date());
      setError(null);
    } catch (e) {
      setError("Cannot reach prometheus-mcp server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  const overallStatus = summary?.overall_status || "unknown";
  const statusColor = {
    healthy: "var(--green)", warning: "var(--amber)",
    critical: "var(--red)", unknown: "var(--text3)",
  }[overallStatus] || "var(--text3)";

  return (
    <>
      <style>{STYLES}</style>

      {/* Top bar */}
      <header style={{
        background: "var(--bg2)", borderBottom: "1px solid var(--border)",
        padding: "0 24px", height: 52,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 28, height: 28, background: "var(--amber2)",
              borderRadius: 4, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 14, color: "var(--bg)", fontWeight: 700,
            }}>∆</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", letterSpacing: 0.5 }}>
                SearchX Observability
              </div>
              <div style={{ fontSize: 9, color: "var(--text3)", letterSpacing: 1.5, textTransform: "uppercase" }}>
                AI Operations Console
              </div>
            </div>
          </div>

          <div style={{ width: 1, height: 28, background: "var(--border)" }} />

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <StatusDot status={overallStatus} />
            <span style={{ fontSize: 11, color: statusColor, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
              {overallStatus}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {lastUpdated && (
            <div style={{ fontSize: 10, color: "var(--text3)" }}>
              Updated {lastUpdated.toLocaleTimeString()} · auto-refresh 30s
            </div>
          )}
          <button
            onClick={fetchMetrics}
            style={{
              background: "var(--bg3)", border: "1px solid var(--border2)",
              borderRadius: 3, padding: "5px 12px", cursor: "pointer",
              color: "var(--text2)", fontSize: 11,
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          >⟳ Refresh</button>
        </div>
      </header>

      {error && (
        <div style={{
          background: "rgba(255,68,85,0.1)", border: "1px solid var(--red2)",
          padding: "10px 24px", fontSize: 12, color: "var(--red)",
        }}>
          ⚠ {error} — make sure prometheus-mcp is running at {MCP_BASE}
        </div>
      )}

      <div style={{ padding: "24px", maxWidth: 1400, margin: "0 auto" }}>

        {/* System label */}
        <div style={{
          fontSize: 10, color: "var(--text3)", letterSpacing: 3,
          textTransform: "uppercase", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <span>SearchX · search-api · Kind/k8s</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span>Prometheus · {OLLAMA_MODEL}</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24, alignItems: "start" }}>

          {/* Left: metrics */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Metric cards row */}
            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
                <div style={{
                  width: 32, height: 32, border: "2px solid var(--border2)",
                  borderTop: "2px solid var(--amber)", borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }} />
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                  <MetricCard
                    title="Search Rate"
                    value={summary?.search_rate?.value}
                    unit="req/min"
                    status={summary?.search_rate?.value > 0 ? "healthy" : "unknown"}
                    detail={summary?.search_rate?.description}
                    delay={0}
                  />
                  <MetricCard
                    title="Avg Latency"
                    value={summary?.latency?.avg_ms}
                    unit="ms"
                    status={summary?.latency?.status}
                    detail={summary?.latency?.description}
                    delay={60}
                  />
                  <MetricCard
                    title="Error Rate"
                    value={summary?.error_rate?.value}
                    unit="%"
                    status={summary?.error_rate?.status}
                    detail={summary?.error_rate?.description}
                    delay={120}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <PodHealthCard pods={summary?.pod_health?.pods} delay={180} />

                  {/* Throughput trend */}
                  <div className="metric-card" style={{
                    background: "var(--bg2)", border: "1px solid var(--border)",
                    borderTop: "2px solid var(--amber)", borderRadius: 4,
                    padding: "20px 24px", animationDelay: "240ms",
                  }}>
                    <div style={{ fontSize: 10, color: "var(--text3)", letterSpacing: 2, marginBottom: 12, textTransform: "uppercase" }}>
                      Throughput · 30m
                    </div>
                    <ThroughputSparkline points={trend} />
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                      <span style={{ fontSize: 10, color: "var(--text3)" }}>30m ago</span>
                      <span style={{ fontSize: 10, color: "var(--text3)" }}>now</span>
                    </div>
                  </div>
                </div>

                {/* Raw metrics strip */}
                <div style={{
                  background: "var(--bg2)", border: "1px solid var(--border)",
                  borderRadius: 4, padding: "14px 20px",
                  display: "flex", gap: 32, flexWrap: "wrap",
                }}>
                  <div style={{ fontSize: 10, color: "var(--text3)", letterSpacing: 2, textTransform: "uppercase", alignSelf: "center", marginRight: 8 }}>
                    Raw
                  </div>
                  {[
                    { label: "pods up", value: `${summary?.pod_health?.up}/${summary?.pod_health?.total}` },
                    { label: "max latency", value: summary?.latency?.max_ms ? `${summary.latency.max_ms}ms` : "N/A" },
                    { label: "errors/min", value: summary?.error_rate?.value !== undefined ? `${((summary.error_rate.value / 100) * (summary.search_rate?.value || 0)).toFixed(2)}` : "N/A" },
                    { label: "trend pts", value: trend.length },
                  ].map(item => (
                    <div key={item.label} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                      <span style={{ fontSize: 10, color: "var(--text3)", letterSpacing: 1 }}>{item.label}</span>
                      <span style={{ fontSize: 13, color: "var(--cyan)", fontWeight: 500 }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Right: chat */}
          <div style={{ height: "calc(100vh - 140px)", position: "sticky", top: 76 }}>
            <ChatPanel summary={summary} trendPoints={trend} />
          </div>
        </div>
      </div>
    </>
  );
}
