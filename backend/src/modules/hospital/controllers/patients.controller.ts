import { Request, Response } from 'express'
import { LabPatient } from '../../lab/models/Patient'
import { LabOrder } from '../../lab/models/Order'
import { LabResult } from '../../lab/models/Result'
import { HospitalToken } from '../models/Token'
import { HospitalPrescription } from '../models/Prescription'
import { DiagnosticOrder } from '../../diagnostic/models/Order'
import { DiagnosticResult } from '../../diagnostic/models/Result'
import xlsx from 'xlsx'

// Helper function to parse various date formats
function parseDate(value: any): string | null {
  if (!value) return null
  
  // If it's already a Date object from xlsx
  if (value instanceof Date) {
    return value.toISOString().split('T')[0]
  }
  
  const str = String(value).trim()
  if (!str) return null
  
  // Try various date formats
  const formats = [
    // DD/MM/YYYY or DD-MM-YYYY
    { regex: /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/, fn: (m: string[]) => `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` },
    // MM/DD/YYYY or MM-DD-YYYY
    { regex: /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/, fn: (m: string[]) => `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` },
    // YYYY/MM/DD or YYYY-MM-DD
    { regex: /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/, fn: (m: string[]) => `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` },
    // DD.MM.YYYY
    { regex: /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, fn: (m: string[]) => `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` },
  ]
  
  for (const format of formats) {
    const match = str.match(format.regex)
    if (match) {
      try {
        const result = format.fn(match)
        // Validate it's a real date
        const d = new Date(result)
        if (!isNaN(d.getTime())) return result
      } catch { }
    }
  }
  
  // Try parsing as standard date string
  const d = new Date(str)
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0]
  }
  
  // Excel serial number (number of days since 1900-01-01)
  const excelSerial = parseFloat(str)
  if (!isNaN(excelSerial) && excelSerial > 0) {
    // Excel epoch is 1900-01-01 (with the 1900 leap year bug)
    const excelEpoch = new Date(1899, 11, 30)
    const date = new Date(excelEpoch.getTime() + excelSerial * 24 * 60 * 60 * 1000)
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]
    }
  }
  
  return str // Return original if can't parse
}

function normalizePhone(p?: string){
  if (!p) return ''
  const digits = String(p).replace(/\D/g, '')
  // normalize to last 10 or 11 digits commonly used
  if (digits.length > 11) return digits.slice(-11)
  return digits
}

export async function search(req: Request, res: Response){
  const q = req.query as any
  const mrn = String(q.mrn || '').trim()
  const name = String(q.name || '').trim()
  const fatherName = String(q.fatherName || '').trim()
  const phone = normalizePhone(String(q.phone || ''))
  const doctorId = String(q.doctorId || '').trim()
  const limit = Math.max(1, Math.min(50, parseInt(String(q.limit || '10')) || 10))

  const criteria: any[] = []
  if (mrn) criteria.push({ mrn: { $regex: new RegExp(mrn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } })
  if (name) criteria.push({ fullName: { $regex: new RegExp(name, 'i') } })
  if (fatherName) criteria.push({ fatherName: { $regex: new RegExp(fatherName, 'i') } })
  if (phone) criteria.push({ phoneNormalized: { $regex: new RegExp(phone + '$') } })

  const filter: any = criteria.length ? { $and: criteria } : {}
  const pats: any[] = await LabPatient.find(filter).limit(limit).lean()

  // Compute visitCount based on Hospital tokens when available
  const tokenCrit: any = { patientId: { $ne: null }, status: { $ne: 'cancelled' } }
  if (doctorId) tokenCrit.doctorId = doctorId

  const countRows = await HospitalToken.aggregate([
    { $match: { ...tokenCrit, patientId: { $in: pats.map(p => p._id) } } },
    { $group: { _id: '$patientId', count: { $sum: 1 } } },
  ])
  const counts = new Map<string, number>(countRows.map((r: any) => [String(r._id), Number(r.count || 0)]))

  const withCounts = pats.map(p => ({ ...p, visitCount: counts.get(String(p._id)) || 0 }))
  res.json({ patients: withCounts })
}

export async function profile(req: Request, res: Response){
  try {
    const mrn = String((req.query as any).mrn || '').trim()
    if (!mrn) return res.status(400).json({ message: 'Validation failed', issues: [{ path: ['mrn'], message: 'mrn is required' }] })

    const patient = await LabPatient.findOne({ mrn }).lean()
    if (!patient) return res.status(404).json({ error: 'Patient not found' })

    const patientId = String((patient as any)._id || '')

    const presRows: any[] = await HospitalPrescription.find({ patientId: (patient as any)._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate({
        path: 'encounterId',
        select: 'doctorId patientId startAt',
        populate: [
          { path: 'doctorId', select: 'name' },
          { path: 'patientId', select: 'fullName mrn' },
        ],
      })
      .lean()
    const pres = presRows.map((p: any) => ({
      id: String(p._id || p.id),
      createdAt: p.createdAt,
      diagnosis: p.diagnosis,
      doctor: p.encounterId?.doctorId?.name || '-',
      items: p.items || [],
    }))

    const labOrders: any[] = await LabOrder.find({ patientId }).sort({ createdAt: -1 }).limit(100).lean()
    const labOrderIds = labOrders.map(o => String(o._id || o.id)).filter(Boolean)
    const labResults: any[] = labOrderIds.length ? await LabResult.find({ orderId: { $in: labOrderIds } }).select('orderId').lean() : []
    const labHas = new Set(labResults.map(r => String(r.orderId)))
    const lab = labOrders
      .filter(o => labHas.has(String(o._id || o.id)))
      .map(o => ({ id: String(o._id || o.id), tokenNo: o.tokenNo, createdAt: o.createdAt, status: o.status, tests: o.tests || [], hasResult: true }))

    const diagOrders: any[] = await DiagnosticOrder.find({ patientId }).sort({ createdAt: -1 }).limit(100).lean()
    const diagOrderIds = diagOrders.map(o => String(o._id || o.id)).filter(Boolean)
    const diagResults: any[] = diagOrderIds.length
      ? await DiagnosticResult.find({ orderId: { $in: diagOrderIds }, status: 'final' }).select('orderId').lean()
      : []
    const diagHas = new Set(diagResults.map(r => String(r.orderId)))
    const diag = diagOrders
      .filter(o => diagHas.has(String(o._id || o.id)))
      .map(o => ({ id: String(o._id || o.id), tokenNo: o.tokenNo, createdAt: o.createdAt, status: o.status, tests: o.tests || [], hasResult: true }))

    res.json({ patient, pres, lab, diag })
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to load patient profile' })
  }
}

export async function importExcel(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const rows: any[] = xlsx.utils.sheet_to_json(worksheet)

    if (!rows.length) {
      return res.status(400).json({ error: 'Excel file is empty or invalid format' })
    }

    const errors: string[] = []
    let imported = 0
    let failed = 0

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2 // +2 because Excel row 1 is headers, and we start counting from 1

      try {
        // Required fields
        const fullName = String(row['Name'] || row['Patient Name'] || row['name'] || row['patientName'] || '').trim()
        if (!fullName) {
          errors.push(`Row ${rowNum}: Patient Name is required`)
          failed++
          continue
        }

        // Optional fields with fallbacks for various column naming conventions
        const fatherName = String(row['Father Name'] || row['Guardian Name'] || row['fatherName'] || row['guardianName'] || '').trim()
        const phone = String(row['Phone'] || row['Mobile'] || row['Contact'] || row['phone'] || row['mobile'] || '').trim()
        const gender = String(row['Gender'] || row['Sex'] || row['gender'] || row['sex'] || '').trim()
        const age = String(row['Age'] || row['age'] || '').trim()
        const cnic = String(row['CNIC'] || row['NIC'] || row['cnic'] || row['nic'] || '').trim()
        const address = String(row['Address'] || row['address'] || '').trim()
        const guardianRel = String(row['Guardian Relation'] || row['Relation'] || row['guardianRel'] || row['guardianRelation'] || '').trim()

        // Normalize phone
        const phoneNormalized = phone.replace(/\D/g, '').slice(-11)

        // Generate MRN if not provided
        const providedMrn = String(row['MRN'] || row['MR Number'] || row['mrn'] || '').trim()
        const mrn = providedMrn || `MR${Date.now()}${i}`

        // Check if patient already exists by MRN or phone
        const existingByMrn = providedMrn ? await LabPatient.findOne({ mrn: providedMrn }).lean() : null

        if (existingByMrn) {
          errors.push(`Row ${rowNum}: Patient with MRN ${mrn} already exists`)
          failed++
          continue
        }

        // Create patient
        const patient = new LabPatient({
          fullName,
          fatherName,
          phone,
          phoneNormalized,
          gender: ['Male', 'Female', 'Other'].includes(gender) ? gender : undefined,
          age: age ? parseInt(age) || undefined : undefined,
          cnic,
          address,
          guardianRel,
          mrn,
          registeredAt: new Date(),
        })

        await patient.save()
        imported++
      } catch (err: any) {
        errors.push(`Row ${rowNum}: ${err?.message || 'Failed to import'}`)
        failed++
      }
    }

    res.json({
      imported,
      failed,
      total: rows.length,
      errors: errors.slice(0, 50), // Limit errors to avoid huge response
    })
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to import patients from Excel' })
  }
}

export async function previewExcel(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const rows: any[] = xlsx.utils.sheet_to_json(worksheet)

    if (!rows.length) {
      return res.status(400).json({ error: 'Excel file is empty or invalid format' })
    }

    const parsedRows: any[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      
      const fullName = String(row['Name'] || row['Patient Name'] || row['name'] || row['patientName'] || '').trim()
      if (!fullName) continue // Skip rows without name

      const fatherName = String(row['Father Name'] || row['Guardian Name'] || row['fatherName'] || row['guardianName'] || row['Father'] || '').trim()
      const phone = String(row['Phone'] || row['Mobile'] || row['Contact'] || row['phone'] || row['mobile'] || '').trim()
      const gender = String(row['Gender'] || row['Sex'] || row['gender'] || row['sex'] || '').trim()
      const age = String(row['Age'] || row['age'] || '').trim()
      const cnic = String(row['CNIC'] || row['NIC'] || row['cnic'] || row['nic'] || '').trim()
      const address = String(row['Address'] || row['address'] || '').trim()
      const guardianRel = String(row['Guardian Relation'] || row['Relation'] || row['guardianRel'] || row['guardianRelation'] || '').trim()
      const providedMrn = String(row['MRN'] || row['MR Number'] || row['mrn'] || row['MR'] || '').trim()
      const doctor = String(row['Doctor'] || row['doctor'] || row['Doctor Name'] || '').trim()
      const lastVisitRaw = row['Last Visit'] || row['lastVisit'] || row['Visit'] || row['last_visit'] || ''
      const lastVisit = parseDate(lastVisitRaw) || String(lastVisitRaw).trim() || ''

      parsedRows.push({
        fullName,
        fatherName,
        phone,
        gender,
        age: age ? parseInt(age) || undefined : undefined,
        cnic,
        address,
        guardianRel,
        mrn: providedMrn,
        doctor,
        lastVisit,
      })
    }

    res.json({ rows: parsedRows, total: parsedRows.length })
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to preview Excel file' })
  }
}

export async function exportPatients(req: Request, res: Response) {
  try {
    const q = req.query as any;
    const mrn = String(q.mrn || '').trim();
    const name = String(q.name || '').trim();
    const fatherName = String(q.fatherName || '').trim();
    const phone = normalizePhone(String(q.phone || ''));

    const criteria: any[] = [];
    if (mrn) criteria.push({ mrn: { $regex: new RegExp(mrn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } });
    if (name) criteria.push({ fullName: { $regex: new RegExp(name, 'i') } });
    if (fatherName) criteria.push({ fatherName: { $regex: new RegExp(fatherName, 'i') } });
    if (phone) criteria.push({ phoneNormalized: { $regex: new RegExp(phone + '$') } });

    const filter: any = criteria.length ? { $and: criteria } : {};
    
    // Fetch patients
    const pats: any[] = await LabPatient.find(filter).sort({ mrn: 1 }).lean();
    console.log(`[Export] Filter: ${JSON.stringify(filter)} | Found: ${pats.length}`);

    // Compute visit counts
    const patientIds = pats.map(p => p._id);
    const countRows = patientIds.length > 0 ? await HospitalToken.aggregate([
      { $match: { patientId: { $in: patientIds }, status: { $ne: 'cancelled' } } },
      { $group: { _id: '$patientId', count: { $sum: 1 } } },
    ]) : [];
    const countsMap = new Map<string, number>(countRows.map((r: any) => [String(r._id), Number(r.count || 0)]));

    // Prepare data for CSV
    const headers = ['MR Number', 'Patient Name', 'Age', 'Gender', 'Phone', 'CNIC', 'Address', 'Number of Visits'];
    let csvContent = headers.join(',') + '\n';

    if (pats.length > 0) {
      pats.forEach(p => {
        const row = [
          `"${String(p.mrn || '').replace(/"/g, '""')}"`,
          `"${String(p.fullName || '').replace(/"/g, '""')}"`,
          `"${p.age != null ? String(p.age).replace(/"/g, '""') : ''}"`,
          `"${String(p.gender || '').replace(/"/g, '""')}"`,
          `"${String(p.phone || '').replace(/"/g, '""')}"`,
          `"${String(p.cnic || '').replace(/"/g, '""')}"`,
          `"${String(p.address || '').replace(/"/g, '""')}"`,
          countsMap.get(String(p._id)) || 0
        ];
        csvContent += row.join(',') + '\n';
      });
    } else {
      csvContent += 'No data found,,,,,,,0\n';
    }

    const buffer = Buffer.from(csvContent, 'utf-8');
    console.log(`[Export] Generated CSV buffer size: ${buffer.length} bytes`);

    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="patients_export.csv"',
      'Content-Length': buffer.length,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    res.end(buffer);
  } catch (e: any) {
    console.error('[Export Error]', e);
    if (!res.headersSent) {
      res.status(500).json({ error: e?.message || 'Failed to export patients' });
    }
  }
}
