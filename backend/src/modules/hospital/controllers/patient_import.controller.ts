import { Request, Response } from 'express'
import { LabPatient } from '../../lab/models/Patient'

function normalizePhone(p?: string) {
  if (!p) return ''
  const digits = String(p).replace(/\D/g, '')
  if (digits.length > 11) return digits.slice(-11)
  return digits
}

function generateMRN(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 5).toUpperCase()
  return `MRN-${timestamp}-${random}`
}

export async function bulkImport(req: Request, res: Response) {
  try {
    const { patients } = req.body as { patients: any[] }
    
    if (!Array.isArray(patients) || patients.length === 0) {
      return res.status(400).json({ error: 'No patients provided' })
    }

    const results = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [] as string[]
    }

    for (const patientData of patients) {
      try {
        // Map Excel columns to schema
        // Use nullish coalescing to handle 0 correctly (0 is falsy but valid MR Number)
        const mrnRaw = patientData.mrn ?? patientData['MR Number'] ?? ''
        const mrn = String(mrnRaw).trim()
        const fullName = String(patientData.name || patientData.Name || '').trim()
        const phone = String(patientData.phone || patientData.Phone || '').trim()
        const age = String(patientData.age || patientData.Age || '').trim()
        const gender = String(patientData.gender || patientData.Gender || '').trim()
        const address = String(patientData.address || patientData.Address || '').trim()
        const fatherName = String(patientData.doctor || patientData.Doctor || patientData.fatherName || '').trim()
        const lastVisit = String(patientData.lastVisit || patientData['Last Visit'] || '').trim()
        const department = String(patientData.department || patientData.Department || '').trim()

        if (!fullName) {
          results.failed++
          results.errors.push(`Row ${results.created + results.failed + results.updated}: Name is required`)
          continue
        }

        // Use provided MRN (even if "0") or generate new one only if MRN is empty
        const finalMRN = mrn !== '' ? mrn : generateMRN()

        // Check if patient exists
        const existing = await LabPatient.findOne({ mrn: finalMRN }).lean()
        
        const patientDoc: any = {
          mrn: finalMRN,
          fullName,
          fatherName: fatherName || undefined,
          phoneNormalized: normalizePhone(phone) || undefined,
          age: age || undefined,
          gender: gender || undefined,
          address: address || undefined,
          lastVisit: lastVisit || undefined,
          department: department || undefined,
          importedAt: new Date().toISOString(),
        }

        if (existing) {
          // Update existing patient
          await LabPatient.updateOne({ _id: (existing as any)._id }, { $set: patientDoc })
          results.updated++
        } else {
          // Create new patient
          await LabPatient.create(patientDoc)
          results.created++
        }
      } catch (err: any) {
        results.failed++
        results.errors.push(`Row ${results.created + results.failed + results.updated}: ${err?.message || 'Unknown error'}`)
      }
    }

    res.json({ 
      success: true, 
      message: `Import complete: ${results.created} created, ${results.updated} updated, ${results.failed} failed`,
      results 
    })
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to import patients' })
  }
}

export async function listImported(req: Request, res: Response) {
  try {
    const patients = await LabPatient.find({ importedAt: { $exists: true } }).sort({ importedAt: -1 }).lean()
    res.json({ patients, count: patients.length })
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to list imported patients' })
  }
}

export async function deleteAllImported(req: Request, res: Response) {
  try {
    const result = await LabPatient.deleteMany({ importedAt: { $exists: true } })
    res.json({ 
      success: true, 
      message: `Deleted ${result.deletedCount} imported patients`,
      deletedCount: result.deletedCount 
    })
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to delete imported patients' })
  }
}
