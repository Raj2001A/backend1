/**
 * WebSocket Service
 * 
 * Provides real-time updates for the dashboard and other components
 * Handles multiple concurrent connections efficiently
 */

import WebSocket from 'ws';
import http from 'http';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { verifyToken } from '../middleware/auth';

// Client connection interface
interface WebSocketClient {
  id: string;
  socket: WebSocket;
  userId: string;
  isAdmin: boolean;
  isAlive: boolean;
  subscriptions: Set<string>;
  lastActivity: Date;
}

// Message interface
interface WebSocketMessage {
  type: string;
  action?: string;
  data?: any;
  channel?: string;
  requestId?: string;
}

// WebSocket service class
class WebSocketService {
  private server: WebSocket.Server | null = null;
  private clients: Map<string, WebSocketClient> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private maxClients: number = 500; // Maximum number of concurrent connections
  private heartbeatInterval: number = 30000; // 30 seconds
  private messageRateLimit: Map<string, number> = new Map(); // Rate limiting for clients
  private messageRateLimitInterval: number = 1000; // 1 second
  private messageRateMax: number = 20; // Maximum messages per interval

  // Initialize the WebSocket server
  public initialize(httpServer: http.Server): void {
    // Create WebSocket server
    this.server = new WebSocket.Server({
      server: httpServer,
      path: '/ws',
      maxPayload: 1024 * 1024, // 1MB max message size
    });

    logger.info('WebSocket server initialized');

    // Set up event handlers
    this.server.on('connection', this.handleConnection.bind(this));
    this.server.on('error', this.handleServerError.bind(this));

    // Start heartbeat interval
    this.pingInterval = setInterval(this.heartbeat.bind(this), this.heartbeatInterval);

    // Log current status every minute
    setInterval(() => {
      logger.info('WebSocket server status', {
        clients: this.clients.size,
        maxClients: this.maxClients,
      });
    }, 60000);
  }

  // Handle new WebSocket connection
  private async handleConnection(socket: WebSocket, request: http.IncomingMessage): Promise<void> {
    try {
      // Check if we've reached the maximum number of clients
      if (this.clients.size >= this.maxClients) {
        logger.warn('Maximum WebSocket connections reached, rejecting new connection');
        socket.close(1013, 'Maximum connections reached');
        return;
      }

      // Extract token from query parameters
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        logger.warn('WebSocket connection attempt without token');
        socket.close(1008, 'Authentication required');
        return;
      }

      // Verify token
      try {
        // @ts-expect-error: bypass type for legacy verifyToken usage
        const user: any = await verifyToken(token, request.socket.remoteAddress as any, request.headers);
        if (!user || !('uid' in user)) {
          logger.warn('WebSocket connection with invalid token');
          socket.close(1008, 'Invalid token');
          return;
        }

        // Create client object
        const clientId = uuidv4();
        const client: WebSocketClient = {
          id: clientId,
          socket,
          userId: typeof user.uid === 'string' ? user.uid : String(user.uid),
          isAdmin: typeof user.role === 'string' ? user.role === 'Administrator' : false,
          isAlive: true,
          subscriptions: new Set(),
          lastActivity: new Date(),
        };

        // Add client to clients map
        this.clients.set(clientId, client);

        // Initialize rate limiting for this client
        this.messageRateLimit.set(clientId, 0);

        logger.info('WebSocket client connected', {
          clientId,
          userId: client.userId,
          isAdmin: client.isAdmin,
          remoteAddress: request.socket.remoteAddress,
        });

        // Set up client event handlers
        socket.on('message', (message: WebSocket.Data) => this.handleMessage(clientId, message));
        socket.on('close', () => this.handleClose(clientId));
        socket.on('error', (error) => this.handleClientError(clientId, error));
        socket.on('pong', () => this.handlePong(clientId));

        // Send welcome message
        this.sendToClient(clientId, {
          type: 'connection',
          data: {
            clientId,
            message: 'Connected to WebSocket server',
            timestamp: new Date().toISOString(),
          },
        });

        // Auto-subscribe admin users to admin channels
        if (client.isAdmin) {
          client.subscriptions.add('admin');
          client.subscriptions.add('dashboard');
        }

        // Auto-subscribe all users to their own user channel
        client.subscriptions.add(`user:${user.uid}`);

      } catch (error) {
        logger.error('Error authenticating WebSocket connection', {
          error: error instanceof Error ? error.message : String(error),
          remoteAddress: request.socket.remoteAddress,
        });
        socket.close(1011, 'Authentication error');
      }
    } catch (error) {
      logger.error('Error handling WebSocket connection', {
        error: error instanceof Error ? error.message : String(error),
      });
      socket.close(1011, 'Server error');
    }
  }

  // Handle incoming WebSocket message
  private handleMessage(clientId: string, data: WebSocket.Data): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Update last activity timestamp
    client.lastActivity = new Date();

    // Check rate limiting
    const currentRate = this.messageRateLimit.get(clientId) || 0;
    if (currentRate >= this.messageRateMax) {
      logger.warn('WebSocket client rate limited', { clientId, userId: client.userId });
      this.sendToClient(clientId, {
        type: 'error',
        data: {
          message: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
        },
      });
      return;
    }

    // Increment rate limit counter
    this.messageRateLimit.set(clientId, currentRate + 1);

    // Parse message
    try {
      const message = JSON.parse(data.toString()) as WebSocketMessage;

      // Handle different message types
      switch (message.type) {
        case 'ping':
          this.sendToClient(clientId, { type: 'pong', requestId: message.requestId });
          break;

        case 'subscribe':
          this.handleSubscribe(clientId, message);
          break;

        case 'unsubscribe':
          this.handleUnsubscribe(clientId, message);
          break;

        case 'dashboard':
          this.handleDashboardRequest(clientId, message);
          break;

        default:
          logger.debug('Unknown WebSocket message type', {
            clientId,
            messageType: message.type,
          });
          this.sendToClient(clientId, {
            type: 'error',
            data: {
              message: 'Unknown message type',
              code: 'UNKNOWN_MESSAGE_TYPE',
            },
            requestId: message.requestId,
          });
      }
    } catch (error) {
      logger.error('Error parsing WebSocket message', {
        clientId,
        error: error instanceof Error ? error.message : String(error),
        data: typeof data === 'string' ? data.substring(0, 100) : 'Binary data',
      });

      this.sendToClient(clientId, {
        type: 'error',
        data: {
          message: 'Invalid message format',
          code: 'INVALID_MESSAGE_FORMAT',
        },
      });
    }
  }

  // Handle subscription request
  private handleSubscribe(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const channel = message.channel;
    if (!channel) {
      this.sendToClient(clientId, {
        type: 'error',
        data: {
          message: 'Channel is required for subscription',
          code: 'MISSING_CHANNEL',
        },
        requestId: message.requestId,
      });
      return;
    }

    // Check if client has permission to subscribe to this channel
    if (this.canSubscribe(client, channel)) {
      client.subscriptions.add(channel);
      this.sendToClient(clientId, {
        type: 'subscribed',
        channel,
        requestId: message.requestId,
      });
      logger.debug('Client subscribed to channel', { clientId, channel });
    } else {
      this.sendToClient(clientId, {
        type: 'error',
        data: {
          message: 'Permission denied for channel subscription',
          code: 'PERMISSION_DENIED',
          channel,
        },
        requestId: message.requestId,
      });
      logger.warn('Client subscription denied', { clientId, channel, userId: client.userId });
    }
  }

  // Handle unsubscribe request
  private handleUnsubscribe(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const channel = message.channel;
    if (!channel) {
      this.sendToClient(clientId, {
        type: 'error',
        data: {
          message: 'Channel is required for unsubscription',
          code: 'MISSING_CHANNEL',
        },
        requestId: message.requestId,
      });
      return;
    }

    // Remove subscription
    client.subscriptions.delete(channel);
    this.sendToClient(clientId, {
      type: 'unsubscribed',
      channel,
      requestId: message.requestId,
    });
    logger.debug('Client unsubscribed from channel', { clientId, channel });
  }

  // Handle dashboard data request
  private handleDashboardRequest(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Only admins can request dashboard data
    if (!client.isAdmin) {
      this.sendToClient(clientId, {
        type: 'error',
        data: {
          message: 'Permission denied for dashboard data',
          code: 'PERMISSION_DENIED',
        },
        requestId: message.requestId,
      });
      return;
    }

    // Handle different dashboard actions
    switch (message.action) {
      case 'get_stats':
        // This would fetch data from the database or cache
        // For now, we'll just send a mock response
        this.sendToClient(clientId, {
          type: 'dashboard',
          action: 'stats',
          data: {
            totalEmployees: 300,
            activeEmployees: 285,
            expiringVisas: 12,
            totalDocuments: 1500,
          },
          requestId: message.requestId,
        });
        break;

      default:
        this.sendToClient(clientId, {
          type: 'error',
          data: {
            message: 'Unknown dashboard action',
            code: 'UNKNOWN_ACTION',
          },
          requestId: message.requestId,
        });
    }
  }

  // Check if client can subscribe to a channel
  private canSubscribe(client: WebSocketClient, channel: string): boolean {
    // Admin users can subscribe to any channel
    if (client.isAdmin) return true;

    // Users can subscribe to their own user channel
    if (channel === `user:${client.userId}`) return true;

    // Users can subscribe to public channels
    if (channel === 'public') return true;

    // Users can subscribe to company channels if they belong to that company
    if (channel.startsWith('company:')) {
      // In a real implementation, we would check if the user belongs to this company
      // For now, we'll just allow it
      return true;
    }

    // Deny all other subscriptions
    return false;
  }

  // Handle WebSocket close event
  private handleClose(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    logger.info('WebSocket client disconnected', {
      clientId,
      userId: client.userId,
      subscriptions: Array.from(client.subscriptions),
    });

    // Clean up client resources
    this.clients.delete(clientId);
    this.messageRateLimit.delete(clientId);
  }

  // Handle WebSocket client error
  private handleClientError(clientId: string, error: Error): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    logger.error('WebSocket client error', {
      clientId,
      userId: client.userId,
      error: error.message,
    });
  }

  // Handle WebSocket server error
  private handleServerError(error: Error): void {
    logger.error('WebSocket server error', {
      error: error.message,
      stack: error.stack,
    });
  }

  // Handle pong response from client
  private handlePong(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.isAlive = true;
  }

  // Send heartbeat ping to all clients
  private heartbeat(): void {
    // Reset rate limiting for all clients
    this.messageRateLimit.clear();

    // Check all clients for heartbeat
    this.clients.forEach((client, clientId) => {
      if (!client.isAlive) {
        logger.warn('WebSocket client failed heartbeat, terminating', { clientId });
        client.socket.terminate();
        this.clients.delete(clientId);
        return;
      }

      // Mark as not alive until pong is received
      client.isAlive = false;

      // Send ping
      try {
        client.socket.ping();
      } catch (error) {
        logger.error('Error sending ping to client', {
          clientId,
          error: error instanceof Error ? error.message : String(error),
        });
        client.socket.terminate();
        this.clients.delete(clientId);
      }
    });
  }

  // Send message to a specific client
  public sendToClient(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      client.socket.send(JSON.stringify(message));
    } catch (error) {
      logger.error('Error sending message to client', {
        clientId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Broadcast message to all clients
  public broadcast(message: WebSocketMessage): void {
    this.clients.forEach((client, clientId) => {
      this.sendToClient(clientId, message);
    });
  }

  // Broadcast message to a specific channel
  public broadcastToChannel(channel: string, message: WebSocketMessage): void {
    this.clients.forEach((client, clientId) => {
      if (client.subscriptions.has(channel)) {
        this.sendToClient(clientId, message);
      }
    });
  }

  // Broadcast message to all admin users
  public broadcastToAdmins(message: WebSocketMessage): void {
    this.clients.forEach((client, clientId) => {
      if (client.isAdmin) {
        this.sendToClient(clientId, message);
      }
    });
  }

  // Broadcast message to a specific user
  public broadcastToUser(userId: string, message: WebSocketMessage): void {
    this.clients.forEach((client, clientId) => {
      if (client.userId === userId) {
        this.sendToClient(clientId, message);
      }
    });
  }

  // Notify about database changes
  public notifyDatabaseChange(table: string, action: string, data: any): void {
    // Broadcast to admin dashboard channel
    this.broadcastToChannel('dashboard', {
      type: 'database_change',
      data: {
        table,
        action,
        timestamp: new Date().toISOString(),
        data,
      },
    });

    // If it's an employee change, notify the employee
    if (table === 'employees' && 'id' in data) {
      this.broadcastToChannel(`user:${data.id}`, {
        type: 'profile_update',
        data: {
          action,
          timestamp: new Date().toISOString(),
          data,
        },
      });
    }

    // If it's a document change, notify the related employee
    if (table === 'documents' && 'employee_id' in data) {
      this.broadcastToChannel(`user:${data.employee_id}`, {
        type: 'document_update',
        data: {
          action,
          timestamp: new Date().toISOString(),
          data,
        },
      });
    }
  }

  // Get current status
  public getStatus(): any {
    return {
      clients: this.clients.size,
      maxClients: this.maxClients,
      channels: this.getChannelStats(),
    };
  }

  // Get channel statistics
  private getChannelStats(): Record<string, number> {
    const stats: Record<string, number> = {};

    this.clients.forEach((client) => {
      client.subscriptions.forEach((channel) => {
        stats[channel] = (stats[channel] || 0) + 1;
      });
    });

    return stats;
  }

  // Shutdown the WebSocket server
  public shutdown(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.server) {
      this.server.close();
      this.server = null;
    }

    // Close all client connections
    this.clients.forEach((client) => {
      try {
        client.socket.close(1001, 'Server shutting down');
      } catch (error) {
        // Ignore errors during shutdown
      }
    });

    this.clients.clear();
    this.messageRateLimit.clear();

    logger.info('WebSocket server shut down');
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

export default websocketService;
