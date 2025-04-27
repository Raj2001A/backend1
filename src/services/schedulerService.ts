/**
 * Scheduler Service
 * 
 * Handles scheduled tasks like database maintenance, cleanup, and notifications
 */

import { logger } from '../utils/logger';
import { Pool } from 'pg';
import { DocumentChunkingService } from './documentChunkingService';
import { backendRegistry } from './backendRegistry';
import websocketService from './websocketService';

// Task interface
interface ScheduledTask {
  name: string;
  interval: number; // in milliseconds
  lastRun: number;
  enabled: boolean;
  handler: () => Promise<void>;
}

// Scheduler service class
class SchedulerService {
  private tasks: ScheduledTask[] = [];
  private intervalId: NodeJS.Timeout | null = null;
  private pool: Pool | null = null;
  private checkInterval = 60000; // 1 minute

  constructor() {
    // Initialize tasks
    this.initializeTasks();
  }

  // Initialize database connection
  public setPool(pool: Pool): void {
    this.pool = pool;
  }

  // Initialize tasks
  private initializeTasks(): void {
    // Add tasks
    this.tasks = [
      {
        name: 'cleanup-expired-uploads',
        interval: 3600000, // 1 hour
        lastRun: 0,
        enabled: true,
        handler: this.cleanupExpiredUploads.bind(this)
      },
      {
        name: 'refresh-dashboard-views',
        interval: 900000, // 15 minutes
        lastRun: 0,
        enabled: true,
        handler: this.refreshDashboardViews.bind(this)
      },
      {
        name: 'cleanup-expired-sessions',
        interval: 3600000, // 1 hour
        lastRun: 0,
        enabled: true,
        handler: this.cleanupExpiredSessions.bind(this)
      },
      {
        name: 'vacuum-analyze-tables',
        interval: 86400000, // 24 hours
        lastRun: 0,
        enabled: true,
        handler: this.vacuumAnalyzeTables.bind(this)
      },
      {
        name: 'check-backend-health',
        interval: 300000, // 5 minutes
        lastRun: 0,
        enabled: true,
        handler: this.checkBackendHealth.bind(this)
      }
    ];
  }

  // Start scheduler
  public start(): void {
    if (this.intervalId) {
      return;
    }

    logger.info('Starting scheduler service');

    // Run tasks immediately on startup
    this.runDueTasks();

    // Set up interval to check for due tasks
    this.intervalId = setInterval(() => {
      this.runDueTasks();
    }, this.checkInterval);
  }

  // Stop scheduler
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Scheduler service stopped');
    }
  }

  // Run due tasks
  private async runDueTasks(): Promise<void> {
    const now = Date.now();

    for (const task of this.tasks) {
      if (!task.enabled) {
        continue;
      }

      // Check if task is due
      if (now - task.lastRun >= task.interval) {
        // Update last run time
        task.lastRun = now;

        // Run task
        try {
          logger.info(`Running scheduled task: ${task.name}`);
          await task.handler();
          logger.info(`Completed scheduled task: ${task.name}`);
        } catch (error) {
          logger.error(`Error running scheduled task: ${task.name}`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          });
        }
      }
    }
  }

  // Enable task
  public enableTask(name: string): boolean {
    const task = this.tasks.find(t => t.name === name);
    if (task) {
      task.enabled = true;
      logger.info(`Enabled scheduled task: ${name}`);
      return true;
    }
    return false;
  }

  // Disable task
  public disableTask(name: string): boolean {
    const task = this.tasks.find(t => t.name === name);
    if (task) {
      task.enabled = false;
      logger.info(`Disabled scheduled task: ${name}`);
      return true;
    }
    return false;
  }

  // Run task immediately
  public async runTaskImmediately(name: string): Promise<boolean> {
    const task = this.tasks.find(t => t.name === name);
    if (task) {
      try {
        logger.info(`Running scheduled task immediately: ${name}`);
        await task.handler();
        task.lastRun = Date.now();
        logger.info(`Completed scheduled task: ${name}`);
        return true;
      } catch (error) {
        logger.error(`Error running scheduled task: ${name}`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
        return false;
      }
    }
    return false;
  }

  // Get task status
  public getTaskStatus(): any[] {
    return this.tasks.map(task => ({
      name: task.name,
      enabled: task.enabled,
      interval: task.interval,
      lastRun: task.lastRun > 0 ? new Date(task.lastRun).toISOString() : 'Never',
      nextRun: task.lastRun > 0 ? new Date(task.lastRun + task.interval).toISOString() : 'Unknown'
    }));
  }

  // Task: Cleanup expired uploads
  private async cleanupExpiredUploads(): Promise<void> {
    DocumentChunkingService.cleanupExpiredUploads();
  }

  // Task: Refresh dashboard views
  private async refreshDashboardViews(): Promise<void> {
    if (!this.pool) {
      logger.warn('Cannot refresh dashboard views: database pool not set');
      return;
    }

    const client = await this.pool.connect();
    try {
      // Refresh materialized views
      await client.query('SELECT refresh_dashboard_views()');

      // Notify WebSocket clients
      websocketService.broadcastToChannel('dashboard', {
        type: 'dashboard_refresh',
        data: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error refreshing dashboard views', {
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      client.release();
    }
  }

  // Task: Cleanup expired sessions
  private async cleanupExpiredSessions(): Promise<void> {
    if (!this.pool) {
      logger.warn('Cannot cleanup expired sessions: database pool not set');
      return;
    }

    const client = await this.pool.connect();
    try {
      // Clean up expired sessions
      const result = await client.query('SELECT cleanup_expired_sessions()');
      const deletedCount = result.rows[0].cleanup_expired_sessions;

      logger.info(`Cleaned up ${deletedCount} expired sessions`);
    } catch (error) {
      logger.error('Error cleaning up expired sessions', {
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      client.release();
    }
  }

  // Task: Vacuum analyze tables
  private async vacuumAnalyzeTables(): Promise<void> {
    if (!this.pool) {
      logger.warn('Cannot vacuum analyze tables: database pool not set');
      return;
    }

    const client = await this.pool.connect();
    try {
      // Get table names
      const tablesResult = await client.query(`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
      `);

      // Vacuum analyze each table
      for (const row of tablesResult.rows) {
        const tableName = row.tablename;
        try {
          await client.query(`VACUUM ANALYZE ${tableName}`);
          logger.info(`Vacuumed and analyzed table: ${tableName}`);
        } catch (error) {
          logger.error(`Error vacuuming table: ${tableName}`, {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    } catch (error) {
      logger.error('Error vacuuming tables', {
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      client.release();
    }
  }

  // Task: Check backend health
  private async checkBackendHealth(): Promise<void> {
    try {
      // Check backend health
      await backendRegistry.checkAllBackends();

      // Get backend status
      const status = backendRegistry.getStatus();

      // Log backend status
      logger.info('Backend health check completed', {
        currentBackend: status.currentBackend,
        strategy: status.strategy,
        offlineCount: status.backends.filter(b => b.status === 'offline').length,
        totalBackends: status.backends.length
      });

      // Notify WebSocket clients if there are offline backends
      if (status.backends.some(b => b.status === 'offline')) {
        websocketService.broadcastToAdmins({
          type: 'backend_status',
          data: {
            status,
            timestamp: new Date().toISOString()
          }
        });
      }
    } catch (error) {
      logger.error('Error checking backend health', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

// Create singleton instance
const schedulerService = new SchedulerService();

export default schedulerService;
