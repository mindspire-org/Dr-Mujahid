import { Router } from 'express'
import { exportAll, purgeAll, restoreAll } from '../backup.controller'
import { getBackupSettings, runBackupNowToDisk, updateBackupSettings } from '../backup.settings.controller'
import { adminGuard } from '../../../common/middleware/admin_guard'

const r = Router()

r.get('/backup/export', adminGuard, exportAll)
r.get('/backup/settings', adminGuard, getBackupSettings)
r.put('/backup/settings', adminGuard, updateBackupSettings)
r.post('/backup/run', adminGuard, runBackupNowToDisk)
r.post('/backup/restore', adminGuard, restoreAll)
r.post('/backup/purge', adminGuard, purgeAll)

export default r
