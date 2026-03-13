import { useState, useRef, useCallback } from 'react'
import { Upload, X, AlertCircle, Check, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import { pharmacyApi } from '../../utils/api'

interface CSVRow {
  name: string
  company?: string
  phone?: string
  address?: string
  taxId?: string
  status?: string
  _valid?: boolean
  _errors?: string[]
}

interface Props {
  open: boolean
  onClose: () => void
  onImportSuccess: () => void
}

const REQUIRED_COLUMNS = ['name']
const OPTIONAL_COLUMNS = ['company', 'phone', 'address', 'taxId', 'status']

function parseCSV(text: string): string[][] {
  const lines: string[][] = []
  let currentLine: string[] = []
  let currentField = ''
  let insideQuotes = false
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = text[i + 1]
    
    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"'
        i++ // skip next quote
      } else {
        insideQuotes = !insideQuotes
      }
    } else if (char === ',' && !insideQuotes) {
      currentLine.push(currentField.trim())
      currentField = ''
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (currentField !== '' || currentLine.length > 0) {
        currentLine.push(currentField.trim())
        if (currentLine.some(f => f !== '')) {
          lines.push(currentLine)
        }
        currentLine = []
        currentField = ''
      }
      if (char === '\r' && nextChar === '\n') i++
    } else {
      currentField += char
    }
  }
  
  if (currentField !== '' || currentLine.length > 0) {
    currentLine.push(currentField.trim())
    if (currentLine.some(f => f !== '')) {
      lines.push(currentLine)
    }
  }
  
  return lines
}

function parseExcel(arrayBuffer: ArrayBuffer): string[][] {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][]
  return data.map(row => row.map(cell => String(cell || '').trim()))
}

function normalizeHeader(header: string): string {
  const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, '')
  const mappings: Record<string, string> = {
    'supplier': 'name',
    'suppliername': 'name',
    'companyname': 'company',
    'phonenumber': 'phone',
    'contact': 'phone',
    'mobile': 'phone',
    'tax': 'taxId',
    'gst': 'taxId',
    'ntn': 'taxId',
    'cnic': 'taxId',
  }
  return mappings[normalized] || normalized
}

function validateRow(row: CSVRow, index: number): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!row.name || row.name.trim() === '') {
    errors.push(`Row ${index + 1}: Supplier name is required`)
  }
  
  if (row.status && !['Active', 'Inactive'].includes(row.status)) {
    errors.push(`Row ${index + 1}: Status must be Active or Inactive`)
  }
  
  return { valid: errors.length === 0, errors }
}

export default function Pharmacy_ImportSuppliersDialog({ open, onClose, onImportSuccess }: Props) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'success' | 'error'>('upload')
  const [parsedData, setParsedData] = useState<CSVRow[]>([])
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [importError, setImportError] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setImportError('')
    const reader = new FileReader()
    
    const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')
    
    reader.onload = (event) => {
      try {
        let lines: string[][]
        
        if (isExcel) {
          const arrayBuffer = event.target?.result as ArrayBuffer
          if (!arrayBuffer || arrayBuffer.byteLength === 0) {
            setImportError('File is empty')
            return
          }
          lines = parseExcel(arrayBuffer)
        } else {
          const text = event.target?.result as string
          if (!text || text.trim() === '') {
            setImportError('File is empty')
            return
          }
          lines = parseCSV(text)
        }
        
        if (lines.length < 2) {
          setImportError('File must have at least a header row and one data row')
          return
        }
        
        const headers = lines[0].map(normalizeHeader)
        const hasRequired = REQUIRED_COLUMNS.every(req => 
          headers.some(h => h.toLowerCase() === req.toLowerCase())
        )
        
        if (!hasRequired) {
          setImportError(`File must contain at least one of these columns: ${REQUIRED_COLUMNS.join(', ')} (found: ${headers.join(', ')})`)
          return
        }
        
        const data: CSVRow[] = []
        const errors: string[] = []
        
        for (let i = 1; i < lines.length; i++) {
          const rowValues = lines[i]
          const row: any = {}
          
          headers.forEach((header, idx) => {
            const value = rowValues[idx]?.trim() || ''
            
            if (header === 'name' || header === 'company' || header === 'phone' || header === 'address' || header === 'taxId') {
              row[header] = value
            } else if (header === 'status') {
              row[header] = value || 'Active'
            }
          })
          
          const validation = validateRow(row, i)
          row._valid = validation.valid
          row._errors = validation.errors
          
          if (!validation.valid) {
            errors.push(...validation.errors)
          }
          
          // Only include rows with at least a name
          if (row.name && row.name.trim() !== '') {
            data.push(row)
          }
        }
        
        setParsedData(data)
        setValidationErrors(errors)
        setStep('preview')
      } catch (err) {
        setImportError('Failed to parse file. Please check the format.')
      }
    }
    
    reader.onerror = () => {
      setImportError('Failed to read file')
    }
    
    if (isExcel) {
      reader.readAsArrayBuffer(file)
    } else {
      reader.readAsText(file)
    }
  }, [])

  const handleImport = useCallback(async () => {
    if (parsedData.length === 0) return
    
    setStep('importing')
    
    try {
      const validRows = parsedData.filter(row => row._valid)
      
      if (validRows.length === 0) {
        throw new Error('No valid rows to import')
      }
      
      // Create suppliers one by one
      for (const row of validRows) {
        await pharmacyApi.createSupplier({
          name: row.name.trim(),
          company: row.company?.trim() || '',
          phone: row.phone?.trim() || '',
          address: row.address?.trim() || '',
          taxId: row.taxId?.trim() || '',
          status: row.status || 'Active',
        })
      }
      
      setStep('success')
      onImportSuccess()
    } catch (err: any) {
      setImportError(err?.message || 'Failed to import suppliers')
      setStep('error')
    }
  }, [parsedData, onImportSuccess])

  const downloadTemplate = useCallback(() => {
    const headers = ['name', 'company', 'phone', 'address', 'taxId', 'status']
    const sampleData = [
      ['ABC Pharma Ltd', 'ABC Pharmaceuticals', '+92-300-1234567', 'Karachi, Pakistan', '12345-6789012-3', 'Active'],
      ['MediCare Supplies', 'MediCare Inc', '+92-321-9876543', 'Lahore, Pakistan', '98765-4321098-7', 'Active'],
    ]
    
    // Create Excel file
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleData])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Suppliers')
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pharmacy_suppliers_template.xlsx'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  const resetAndClose = useCallback(() => {
    setStep('upload')
    setParsedData([])
    setValidationErrors([])
    setImportError('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onClose()
  }, [onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-800">Import Suppliers from CSV/Excel</h3>
          <button onClick={resetAndClose} className="rounded-full p-1 hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[70vh] overflow-y-auto p-6">
          {step === 'upload' && (
            <div className="space-y-4">
              <div 
                className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center cursor-pointer hover:bg-slate-100"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mx-auto h-12 w-12 text-slate-400" />
                <p className="mt-4 text-sm text-slate-600">
                  Drag and drop your CSV or Excel file here, or
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    fileInputRef.current?.click()
                  }}
                  className="mt-2 rounded-md bg-navy-600 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700"
                >
                  Select File
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Supported formats: CSV, XLSX with headers
                </p>
              </div>

              {importError && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-slate-800">Download Template</h4>
                    <p className="text-sm text-slate-600">
                      Get a sample Excel file with the correct format
                    </p>
                  </div>
                  <button
                    onClick={downloadTemplate}
                    className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-4 w-4" />
                    Template
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <h4 className="mb-2 font-medium text-slate-800">Required Columns</h4>
                <div className="flex flex-wrap gap-2">
                  {REQUIRED_COLUMNS.map(col => (
                    <span key={col} className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                      {col}
                    </span>
                  ))}
                </div>
                <h4 className="mb-2 mt-4 font-medium text-slate-800">Optional Columns</h4>
                <div className="flex flex-wrap gap-2">
                  {OPTIONAL_COLUMNS.map(col => (
                    <span key={col} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-slate-800">Preview Data</h4>
                  <p className="text-sm text-slate-600">
                    {parsedData.length} rows found • {parsedData.filter(r => r._valid).length} valid
                  </p>
                </div>
                {validationErrors.length > 0 && (
                  <div className="rounded-lg bg-yellow-50 px-3 py-1 text-sm text-yellow-700">
                    {validationErrors.length} validation issues
                  </div>
                )}
              </div>

              {validationErrors.length > 0 && (
                <div className="max-h-32 overflow-y-auto rounded-lg bg-yellow-50 p-3">
                  <ul className="space-y-1 text-sm text-yellow-700">
                    {validationErrors.slice(0, 10).map((err, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        {err}
                      </li>
                    ))}
                    {validationErrors.length > 10 && (
                      <li className="text-xs">...and {validationErrors.length - 10} more</li>
                    )}
                  </ul>
                </div>
              )}

              <div className="max-h-64 overflow-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-100">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-slate-700">Status</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-700">Name</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-700">Company</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-700">Phone</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-700">Address</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-700">Tax ID</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.map((row, i) => (
                      <tr key={i} className={row._valid ? '' : 'bg-red-50'}>
                        <td className="px-3 py-2">
                          {row._valid ? (
                            <Check className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-600" />
                          )}
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-800">{row.name}</td>
                        <td className="px-3 py-2 text-slate-600">{row.company || '-'}</td>
                        <td className="px-3 py-2 text-slate-600">{row.phone || '-'}</td>
                        <td className="px-3 py-2 text-slate-600">{row.address || '-'}</td>
                        <td className="px-3 py-2 text-slate-600">{row.taxId || '-'}</td>
                        <td className="px-3 py-2 text-slate-600">{row.status || 'Active'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="sticky bottom-0 bg-white pt-4 border-t border-slate-200 flex gap-2">
                <button
                  onClick={() => setStep('upload')}
                  className="rounded-md border border-blue-800 text-blue-800 px-4 py-2 text-sm font-medium hover:bg-blue-50"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={parsedData.filter(r => r._valid).length === 0}
                  className="rounded-md border border-blue-800 text-blue-800 px-4 py-2 text-sm font-medium hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Import {parsedData.filter(r => r._valid).length} Suppliers
                </button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="py-12 text-center">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-navy-200 border-t-navy-600"></div>
              <p className="mt-4 text-slate-600">Importing suppliers...</p>
            </div>
          )}

          {step === 'success' && (
            <div className="py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <Check className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="mt-4 text-lg font-medium text-slate-800">Import Successful!</p>
              <p className="text-slate-600">
                {parsedData.filter(r => r._valid).length} suppliers added
              </p>
              <button
                onClick={resetAndClose}
                className="mt-6 rounded-md bg-navy-600 px-6 py-2 text-sm font-medium text-white hover:bg-navy-700"
              >
                Done
              </button>
            </div>
          )}

          {step === 'error' && (
            <div className="py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <p className="mt-4 text-lg font-medium text-slate-800">Import Failed</p>
              <p className="text-red-600">{importError}</p>
              <div className="mt-6 flex justify-center gap-2">
                <button
                  onClick={() => setStep('preview')}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Back to Preview
                </button>
                <button
                  onClick={() => setStep('upload')}
                  className="rounded-md bg-navy-600 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
