import { allowServer, deleteMyAccount, finishLogin, loadAccount, lock, signOutDevice, startLogin, syncNow, unlock } from './sync'
import { disableTelemetry, enableTelemetry, loadTelemetry, noteEvent, pendingLines, telemetryAvailable } from './telemetry'
import type { AccountApi } from '../entrypoints/options/AccountPage'

// The real thing behind the Akun page.
export const accountApi: AccountApi = {
  load: loadAccount,
  allow: allowServer,
  startLogin,
  finishLogin,
  unlock,
  sync: async (options) => {
    const report = await syncNow(options)
    if (!report.error) await noteEvent('sync_run')
    return report as Awaited<ReturnType<AccountApi['sync']>>
  },
  lock,
  signOut: signOutDevice,
  deleteAccount: deleteMyAccount,
  telemetry: {
    available: telemetryAvailable,
    isOn: async () => (await loadTelemetry()).enabled,
    enable: () => enableTelemetry(),
    disable: disableTelemetry,
    pending: pendingLines,
  },
}
