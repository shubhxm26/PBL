/**
 * WebSocket Telemetry Client
 * Manages resilient bidirectional WebSocket connection to /ws/telemetry,
 * handles automatic reconnection with exponential backoff, heartbeat keepalive,
 * and distributes live telematics ticks, re-route events, and simulation state changes.
 */

class TelemetryWebSocketClient {
  constructor() {
    this.ws = null;
    this.status = 'DISCONNECTED'; // CONNECTING, CONNECTED, DISCONNECTED, ERROR
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 20;
    this.baseReconnectDelayMs = 1000;
    this.reconnectTimer = null;
    this.pingTimer = null;
    this.listeners = {
      tick: new Set(),
      reroute: new Set(),
      state: new Set(),
      status: new Set(),
      roadblocks: new Set(),
      roadblocksCleared: new Set()
    };
  }

  getWebSocketUrl() {
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const proto = isHttps ? 'wss:' : 'ws:';
    
    // In dev with Vite proxy, ws://localhost:5173/ws/telemetry proxies to ws://localhost:8000
    // Alternatively direct connect to backend port 8000 if running locally
    if (typeof window !== 'undefined') {
      const host = window.location.host;
      return `${proto}//${host}/ws/telemetry`;
    }
    return 'ws://localhost:8000/ws/telemetry';
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const url = this.getWebSocketUrl();
    this.setStatus('CONNECTING');

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.setStatus('CONNECTED');
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        // Immediately request state & corridor resynchronization upon connection/reconnection
        this.resync();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleIncomingMessage(data);
        } catch (err) {
          console.error('[TelemetryWS] Failed to parse message JSON:', err);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[TelemetryWS] WebSocket error:', err);
        this.setStatus('ERROR');
      };

      this.ws.onclose = (event) => {
        this.stopHeartbeat();
        this.setStatus('DISCONNECTED');
        this.scheduleReconnect();
      };
    } catch (err) {
      console.warn('[TelemetryWS] Connection creation failed:', err);
      this.setStatus('DISCONNECTED');
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[TelemetryWS] Max reconnect attempts reached.');
      return;
    }

    const delay = Math.min(
      this.baseReconnectDelayMs * Math.pow(1.5, this.reconnectAttempts),
      10000
    );
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ action: 'ping' });
      }
    }, 20000);
  }

  stopHeartbeat() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  setStatus(newStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.notifyListeners('status', newStatus);
    }
  }

  handleIncomingMessage(msg) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'TELEMETRY_TICK':
      case 'CONNECTION_ESTABLISHED':
        this.notifyListeners('tick', msg);
        if (msg.simulation) {
          this.notifyListeners('state', msg.simulation);
        }
        if (msg.active_roadblocks) {
          this.notifyListeners('roadblocks', msg.active_roadblocks);
        }
        break;

      case 'REROUTE_EVENT':
        this.notifyListeners('reroute', msg);
        break;

      case 'SIMULATION_STATE':
        this.notifyListeners('tick', msg);
        if (msg.simulation) {
          this.notifyListeners('state', msg.simulation);
        }
        if (msg.active_roadblocks) {
          this.notifyListeners('roadblocks', msg.active_roadblocks);
        }
        break;

      case 'ROADBLOCKS_CLEARED':
        this.notifyListeners('roadblocksCleared', msg);
        this.notifyListeners('roadblocks', []);
        break;

      case 'PONG':
        // Heartbeat acknowledged
        break;

      default:
        break;
    }
  }

  notifyListeners(channel, data) {
    const list = this.listeners[channel];
    if (list) {
      list.forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error(`[TelemetryWS] Listener error in channel ${channel}:`, e);
        }
      });
    }
  }

  subscribe(channel, callback) {
    if (this.listeners[channel]) {
      this.listeners[channel].add(callback);
      return () => this.listeners[channel].delete(callback);
    }
    return () => {};
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  // Playback control helpers
  play() {
    return this.send({ action: 'play' });
  }

  pause() {
    return this.send({ action: 'pause' });
  }

  step(stepSeconds = 15) {
    return this.send({ action: 'step', step_seconds: stepSeconds });
  }

  setSpeed(multiplier = 1.0) {
    return this.send({ action: 'set_speed', speed: multiplier });
  }

  reset() {
    return this.send({ action: 'reset' });
  }

  injectRoadblock(roadblock) {
    return this.send({
      action: 'inject_disruption',
      ...roadblock
    });
  }

  clearRoadblocks() {
    return this.send({ action: 'clear_disruptions' });
  }

  resync() {
    return this.send({ action: 'resync' });
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('DISCONNECTED');
  }
}

// Singleton export
export const telemetryWS = new TelemetryWebSocketClient();
