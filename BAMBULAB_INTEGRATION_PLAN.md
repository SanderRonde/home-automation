# Bambu Lab P1P Integration Plan

## Overview

This plan outlines the integration of Bambu Lab P1P 3D printer monitoring into the home automation system. The integration will use MQTT to monitor printer status and provide a configuration UI for setup.

## NPM Package Selection

After reviewing available packages:

- **bambu-js** (v3.0.1) - Actively maintained (Aug 2025), supports MQTT, FTP, camera
- **bambu-node** (v3.22.21) - Also actively maintained (Aug 2024), TypeScript-focused

**Recommendation: bambu-js**
- More recent updates
- Keywords explicitly mention: bambu, printer, mqtt, ftp, camera
- Better documentation based on npm info
- Provides comprehensive tooling for future expansion (camera, FTP)

## Module Structure

Following the project's modular architecture pattern:

```
app/server/modules/bambulab/
├── index.ts              # Module entry point (BambuLabMeta class)
├── routing.ts            # API routes for config and status
├── client/
│   ├── api.ts           # MQTT client wrapper
│   └── device.ts        # Optional: Device abstraction for Matter.js integration
└── types.ts             # TypeScript type definitions
```

## Database Schema

Create `database/bambulab.json` with the following structure:

```typescript
interface BambuLabDB {
  config?: {
    ip: string;           // Printer IP address
    serial: string;       // Printer serial number
    accessCode: string;   // Access code for authentication
    enabled?: boolean;    // Whether monitoring is enabled (default: true)
  };
  // Runtime state (not user-editable)
  lastStatus?: {
    timestamp: number;
    state: string;       // printing, idle, error, etc.
    temperature?: {
      bed?: number;
      nozzle?: number;
    };
    progress?: number;   // 0-100
    currentFile?: string;
  };
}
```

## Backend Implementation

### 1. Module Entry Point (`index.ts`)

```typescript
import { ModuleMeta } from '../meta';
import type { ModuleConfig } from '..';
import type { Database } from '../../lib/db';
import { initRouting } from './routing';
import { BambuLabAPI } from './client/api';
import { logTag } from '../../lib/logging/logger';

export interface BambuLabDB {
  config?: {
    ip: string;
    serial: string;
    accessCode: string;
    enabled?: boolean;
  };
  lastStatus?: {
    timestamp: number;
    state: string;
    temperature?: {
      bed?: number;
      nozzle?: number;
    };
    progress?: number;
    currentFile?: string;
  };
}

export const BambuLab = new (class BambuLab extends ModuleMeta {
  public name = 'bambulab';
  private _api: BambuLabAPI | null = null;
  private _config: ModuleConfig | null = null;

  public init(config: ModuleConfig) {
    this._config = config;
    const db = config.db as Database<BambuLabDB>;

    // Subscribe to config changes
    db.subscribe(async (data) => {
      if (!data?.config) {
        this._disconnectClient();
        return;
      }

      if (data.config.enabled !== false) {
        await this._connectClient(data.config, config);
      } else {
        this._disconnectClient();
      }
    });

    // Initialize on startup if config exists
    const currentConfig = db.current()?.config;
    if (currentConfig && currentConfig.enabled !== false) {
      void this._connectClient(currentConfig, config);
    }

    return {
      serve: initRouting(db),
    };
  }

  private async _connectClient(
    config: { ip: string; serial: string; accessCode: string },
    moduleConfig: ModuleConfig
  ) {
    try {
      // Disconnect existing client
      this._disconnectClient();

      // Create new API client
      this._api = new BambuLabAPI(
        config.ip,
        config.serial,
        config.accessCode,
        async (status) => {
          // Callback for status updates
          const db = moduleConfig.db as Database<BambuLabDB>;
          await db.setVal('lastStatus', {
            timestamp: Date.now(),
            ...status,
          });

          // Publish to WebSocket
          await moduleConfig.wsPublish(
            JSON.stringify({
              type: 'status_update',
              data: status,
            })
          );
        }
      );

      await this._api.connect();
      logTag('bambulab', 'green', `Connected to printer at ${config.ip}`);
    } catch (error) {
      logTag('bambulab', 'red', 'Failed to connect to printer:', error);
      this._api = null;
    }
  }

  private _disconnectClient() {
    if (this._api) {
      this._api.disconnect();
      this._api = null;
      logTag('bambulab', 'yellow', 'Disconnected from printer');
    }
  }

  public override async onOffline() {
    // Pause monitoring when system goes offline
    this._disconnectClient();
  }

  public override async onBackOnline() {
    // Reconnect when system comes back online
    if (!this._config) return;

    const db = this._config.db as Database<BambuLabDB>;
    const config = db.current()?.config;
    if (config && config.enabled !== false) {
      await this._connectClient(config, this._config);
    }
  }

  public getStatus() {
    return this._api?.getStatus() ?? null;
  }
})();
```

### 2. MQTT Client Wrapper (`client/api.ts`)

```typescript
import type { Printer } from 'bambu-js';
// Import appropriate types from bambu-js

export interface PrinterStatus {
  state: string;
  temperature?: {
    bed?: number;
    nozzle?: number;
  };
  progress?: number;
  currentFile?: string;
}

export class BambuLabAPI {
  private _client: Printer | null = null;
  private _connected = false;

  constructor(
    private _ip: string,
    private _serial: string,
    private _accessCode: string,
    private _onStatusUpdate: (status: PrinterStatus) => Promise<void>
  ) {}

  public async connect(): Promise<void> {
    // Initialize bambu-js client
    // Set up MQTT connection
    // Subscribe to status topics
    // Call _onStatusUpdate when messages arrive
  }

  public disconnect(): void {
    // Clean up MQTT connection
    // Unsubscribe from topics
  }

  public getStatus(): PrinterStatus | null {
    // Return current cached status
  }

  private _handleMessage(topic: string, message: Buffer): void {
    // Parse MQTT message
    // Transform to PrinterStatus
    // Call _onStatusUpdate
  }
}
```

### 3. API Routes (`routing.ts`)

```typescript
import { createServeOptions, withRequestBody } from '../../lib/routes';
import type { Database } from '../../lib/db';
import type { BambuLabDB } from './index';
import * as z from 'zod';

const configSchema = z.object({
  ip: z.string().min(1),
  serial: z.string().min(1),
  accessCode: z.string().min(1),
  enabled: z.boolean().optional(),
});

export const initRouting = (db: Database<BambuLabDB>) => {
  return createServeOptions({
    // Get current configuration (masked)
    '/config': {
      GET: async (req, server, { json }) => {
        const data = db.current();
        const config = data?.config;

        if (!config) {
          return json({
            hasConfig: false,
          });
        }

        return json({
          hasConfig: true,
          ip: config.ip,
          serial: config.serial,
          // Mask access code for security
          accessCodeMasked: `${config.accessCode.substring(0, 4)}••••`,
          enabled: config.enabled ?? true,
        });
      },
    },

    // Save configuration
    '/config': withRequestBody(
      configSchema,
      async (body, req, server, { json }) => {
        await db.setVal('config', {
          ip: body.ip,
          serial: body.serial,
          accessCode: body.accessCode,
          enabled: body.enabled ?? true,
        });

        return json({ success: true });
      }
    ),

    // Get current printer status
    '/status': {
      GET: async (req, server, { json }) => {
        const data = db.current();
        return json({
          status: data?.lastStatus ?? null,
          connected: data?.config?.enabled ?? false,
        });
      },
    },

    // Test connection
    '/test': {
      POST: async (req, server, { json }) => {
        // Could implement a test connection without saving
        // This would require temporarily connecting to the printer
        return json({ success: true, message: 'Test not yet implemented' });
      },
    },
  });
};

export type BambuLabRoutes = typeof routes;
```

## Frontend Configuration UI

Create `app/client/dashboard/components/BambuLabConfig.tsx`:

```typescript
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Stack,
  TextField,
  InputAdornment,
  IconButton,
  Switch,
  FormControlLabel,
  Chip,
} from '@mui/material';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/fetch';
import SaveIcon from '@mui/icons-material/Save';

interface ConfigState {
  hasConfig: boolean;
  ip?: string;
  serial?: string;
  accessCodeMasked?: string;
  enabled?: boolean;
}

interface StatusState {
  status: {
    timestamp: number;
    state: string;
    temperature?: {
      bed?: number;
      nozzle?: number;
    };
    progress?: number;
    currentFile?: string;
  } | null;
  connected: boolean;
}

export const BambuLabConfig = (): JSX.Element => {
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [status, setStatus] = useState<StatusState | null>(null);
  const [ip, setIp] = useState<string>('');
  const [serial, setSerial] = useState<string>('');
  const [accessCode, setAccessCode] = useState<string>('');
  const [enabled, setEnabled] = useState<boolean>(true);
  const [showAccessCode, setShowAccessCode] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load config and status on mount
  useEffect(() => {
    void loadConfig();
    void loadStatus();

    // Poll status every 5 seconds
    const interval = setInterval(() => {
      void loadStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadConfig = async () => {
    try {
      const response = await apiGet('bambulab', '/config', {});
      if (response.ok) {
        const data = (await response.json()) as ConfigState;
        setConfig(data);
        if (data.hasConfig) {
          setIp(data.ip ?? '');
          setSerial(data.serial ?? '');
          setEnabled(data.enabled ?? true);
        }
      }
    } catch (err) {
      console.error('Failed to load Bambu Lab config:', err);
    }
  };

  const loadStatus = async () => {
    try {
      const response = await apiGet('bambulab', '/status', {});
      if (response.ok) {
        const data = (await response.json()) as StatusState;
        setStatus(data);
      }
    } catch (err) {
      console.error('Failed to load Bambu Lab status:', err);
    }
  };

  const saveConfig = async () => {
    if (!ip.trim() || !serial.trim() || (!accessCode.trim() && !config?.hasConfig)) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await apiPost(
        'bambulab',
        '/config',
        {},
        {
          ip: ip.trim(),
          serial: serial.trim(),
          accessCode: accessCode.trim() || undefined,
          enabled,
        }
      );

      if (response.ok) {
        setSuccess('Configuration saved successfully');
        setAccessCode(''); // Clear access code field
        await loadConfig();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to save configuration');
      }
    } catch {
      setError('Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800 }}>
      <Stack spacing={3}>
        <Alert severity="info">
          Bambu Lab integration monitors your P1P 3D printer via MQTT. Configure the
          printer's IP address, serial number, and access code below.
        </Alert>

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* Configuration Card */}
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6" gutterBottom>
                Printer Configuration
              </Typography>

              <TextField
                fullWidth
                label="IP Address"
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                placeholder="192.168.1.100"
                disabled={loading}
                helperText="Local IP address of your Bambu Lab printer"
              />

              <TextField
                fullWidth
                label="Serial Number"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                placeholder="01P00A123456789"
                disabled={loading}
                helperText="Serial number from printer settings"
              />

              <TextField
                fullWidth
                label="Access Code"
                type={showAccessCode ? 'text' : 'password'}
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder={
                  config?.hasConfig ? 'Leave blank to keep current' : 'Enter access code'
                }
                disabled={loading}
                helperText="Access code from printer settings (LAN mode)"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowAccessCode(!showAccessCode)}
                        edge="end"
                        aria-label="toggle access code visibility"
                      >
                        {showAccessCode ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    disabled={loading}
                  />
                }
                label="Enable monitoring"
              />

              <Box>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => void saveConfig()}
                  startIcon={<SaveIcon />}
                  size="large"
                  disabled={loading || !ip.trim() || !serial.trim()}
                >
                  Save Configuration
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {/* Status Card */}
        {status && (
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6">Printer Status</Typography>
                  <Chip
                    label={status.connected ? 'Connected' : 'Disconnected'}
                    color={status.connected ? 'success' : 'default'}
                    size="small"
                  />
                </Box>

                {status.status ? (
                  <Stack spacing={1}>
                    <Typography variant="body2">
                      <strong>State:</strong> {status.status.state}
                    </Typography>
                    {status.status.progress !== undefined && (
                      <Typography variant="body2">
                        <strong>Progress:</strong> {status.status.progress}%
                      </Typography>
                    )}
                    {status.status.currentFile && (
                      <Typography variant="body2">
                        <strong>File:</strong> {status.status.currentFile}
                      </Typography>
                    )}
                    {status.status.temperature && (
                      <>
                        {status.status.temperature.bed !== undefined && (
                          <Typography variant="body2">
                            <strong>Bed Temp:</strong> {status.status.temperature.bed}°C
                          </Typography>
                        )}
                        {status.status.temperature.nozzle !== undefined && (
                          <Typography variant="body2">
                            <strong>Nozzle Temp:</strong>{' '}
                            {status.status.temperature.nozzle}°C
                          </Typography>
                        )}
                      </>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      Last update: {new Date(status.status.timestamp).toLocaleString()}
                    </Typography>
                  </Stack>
                ) : (
                  <Typography color="text.secondary">
                    No status data available. Ensure the printer is configured and online.
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Help Card */}
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Setup Instructions</Typography>
              <Typography variant="body2" component="div">
                <ol>
                  <li>Enable LAN mode on your Bambu Lab printer</li>
                  <li>
                    Find the printer's IP address, serial number, and access code in printer
                    settings
                  </li>
                  <li>Enter the configuration details above</li>
                  <li>Click "Save Configuration" to start monitoring</li>
                </ol>
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
};
```

## Module Registration

### 1. Register in `app/server/modules/modules.ts`

Add to the module list:

```typescript
import { BambuLab } from './bambulab';

const getModuleObj = () => ({
  // ... existing modules
  bambulab: BambuLab,
});
```

### 2. Add to type definitions

Ensure TypeScript types are exported and available.

### 3. Register in dashboard

Add the config component to the dashboard settings/config page (wherever other integrations are shown).

## Dependencies

Add to `package.json`:

```bash
bun add bambu-js
```

## Implementation Steps

### Phase 1: Backend Foundation
1. ✅ Research and select NPM package
2. Create module structure (`app/server/modules/bambulab/`)
3. Implement `index.ts` with basic module setup
4. Create database schema in `types.ts`
5. Implement basic routing in `routing.ts`
6. Register module in `modules.ts`

### Phase 2: MQTT Integration
1. Implement `client/api.ts` with bambu-js
2. Set up MQTT connection and authentication
3. Parse MQTT messages and extract status
4. Implement status update callbacks
5. Add WebSocket publishing for real-time updates
6. Test connection and data flow

### Phase 3: Frontend Configuration
1. Create `BambuLabConfig.tsx` component
2. Implement config loading and saving
3. Add status display with polling
4. Add form validation and error handling
5. Register component in dashboard
6. Test UI flow

### Phase 4: Testing & Refinement
1. Test with actual P1P printer
2. Handle edge cases (disconnections, errors)
3. Add proper error messages
4. Implement reconnection logic
5. Add logging for debugging
6. Run `bun lint` and fix any issues

## Future Enhancements (Not in Initial Scope)

- Dashboard visualization widget for printer status
- Push notifications for print completion/errors
- Camera stream integration (FTP support in bambu-js)
- Print job history tracking
- Integration with device module for unified control
- Matter.js device registration (if applicable)
- Scene automation (e.g., turn on lights when print completes)

## Security Considerations

- Access code stored in JSON database (consider encryption)
- Mask access code in API responses
- MQTT connection should use local network only
- Validate all user inputs
- Consider adding rate limiting to prevent abuse

## Reference Materials

- bambu-js package: https://www.npmjs.com/package/bambu-js
- Bambu Lab API documentation (if available)
- Python bambulabs_api package for inspiration
- Existing module implementations:
  - `app/server/modules/tuya/` (similar config pattern)
  - `app/server/modules/nuki/` (token-based auth)
  - `app/server/modules/wled/` (IP-based device discovery)

## Notes

- No visualization/dashboard widgets in initial implementation
- Focus on configuration UI and backend monitoring
- MQTT connection lifecycle managed by module
- WebSocket updates for real-time status (optional for UI)
- Follow project conventions (Bun runtime, TypeScript, MUI)
