import { useEffect, useMemo, useState } from 'react'
import { X, Plus, Eye, CheckCircle, Trash2, FileText } from 'lucide-react'

export interface LabTemplate {
  _id?: string
  doctorId: string
  name: string
  tests: string[]
  createdAt?: string
  updatedAt?: string
}

interface AddTemplateDialogProps {
  open: boolean
  onClose: () => void
  onSave: (template: Omit<LabTemplate, '_id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  doctorId: string
  availableTests: readonly string[]
  customTests: string[]
}

function AddTemplateDialogComponent({
  open,
  onClose,
  onSave,
  doctorId,
  availableTests,
  customTests,
}: AddTemplateDialogProps) {
  const [name, setName] = useState('')
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  // Combine quick tests and custom tests
  const allTests = useMemo(() => {
    const uniqueCustom = customTests.filter(t => !availableTests.includes(t))
    return [...availableTests, ...uniqueCustom]
  }, [availableTests, customTests])

  useEffect(() => {
    if (open) {
      setName('')
      setSelectedTests(new Set())
      setError('')
    }
  }, [open])

  if (!open) return null

  const toggleTest = (testName: string) => {
    setSelectedTests(prev => {
      const next = new Set(prev)
      if (next.has(testName)) {
        next.delete(testName)
      } else {
        next.add(testName)
      }
      return next
    })
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Template name is required')
      return
    }
    if (selectedTests.size === 0) {
      setError('Please select at least one test')
      return
    }
    if (!doctorId) {
      setError('Doctor ID is missing. Please refresh the page and try again.')
      return
    }

    setIsSaving(true)
    setError('')
    try {
      await onSave({
        doctorId,
        name: name.trim(),
        tests: Array.from(selectedTests),
      })
      onClose()
    } catch (e: any) {
      setError(e?.message || 'Failed to save template')
    } finally {
      setIsSaving(false)
    }
  }

  const checkboxCardLabelCls = (checked: boolean) =>
    `flex items-center gap-2 rounded-md border ${checked ? 'border-blue-800' : 'border-slate-200'} bg-white px-3 py-2 text-sm text-slate-700 hover:border-blue-800 cursor-pointer transition-colors`

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4">
      <div className="mt-8 w-full max-w-4xl rounded-xl border border-slate-200 bg-white p-5 shadow-lg max-h-[85vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-lg font-semibold text-slate-800">Add Lab Template</div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
            disabled={isSaving}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Template Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Enter template name (e.g., Diabetes Screening, Male Infertility Panel)"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-800 focus:outline-none focus:ring-1 focus:ring-blue-800"
          />
        </div>

        <div className="mb-4">
          <div className="mb-2 text-sm font-semibold text-slate-800">
            Select Tests <span className="text-rose-500">*</span>
            <span className="ml-2 text-xs font-normal text-slate-500">
              ({selectedTests.size} selected)
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {allTests.map(test => {
              const checked = selectedTests.has(test)
              return (
                <label key={test} className={checkboxCardLabelCls(checked)}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleTest(test)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-800 focus:ring-blue-800"
                  />
                  <span className="flex-1">{test}</span>
                </label>
              )
            })}
          </div>
          {allTests.length === 0 && (
            <div className="rounded-md border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
              No tests available. Please add tests in the lab orders section first.
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !name.trim() || selectedTests.size === 0}
            className="inline-flex items-center gap-2 rounded-md bg-blue-800 px-4 py-2 text-sm font-medium text-white hover:bg-blue-900 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Save Template
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// View Templates Dialog
interface ViewTemplatesDialogProps {
  open: boolean
  onClose: () => void
  templates: LabTemplate[]
  onApply: (template: LabTemplate) => void
  onDelete: (templateId: string) => Promise<void>
  isLoading: boolean
}

function ViewTemplatesDialog({
  open,
  onClose,
  templates,
  onApply,
  onDelete,
  isLoading,
}: ViewTemplatesDialogProps) {
  const [viewingTemplate, setViewingTemplate] = useState<LabTemplate | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteConfirmTemplate, setDeleteConfirmTemplate] = useState<LabTemplate | null>(null)

  useEffect(() => {
    if (open) {
      setViewingTemplate(null)
      setDeletingId(null)
      setDeleteConfirmTemplate(null)
    }
  }, [open])

  if (!open) return null

  const handleDelete = async (template: LabTemplate) => {
    if (!template._id) return
    setDeleteConfirmTemplate(template)
  }

  const confirmDelete = async () => {
    if (!deleteConfirmTemplate?._id) return
    
    setDeletingId(deleteConfirmTemplate._id)
    try {
      await onDelete(deleteConfirmTemplate._id)
      setDeleteConfirmTemplate(null)
    } catch (e) {
      // Error handled by parent
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4">
      <div className="mt-8 w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-lg max-h-[85vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-800" />
            <div className="text-lg font-semibold text-slate-800">My Lab Templates</div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-800 border-t-transparent" />
          </div>
        ) : templates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
            <FileText className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-2 text-sm text-slate-600">No templates saved yet.</p>
            <p className="text-xs text-slate-500">Click "Add Template" to create your first lab test template.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map(template => (
              <div
                key={template._id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 hover:border-blue-300 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800 truncate">{template.name}</div>
                  <div className="text-xs text-slate-500">
                    {template.tests.length} test{template.tests.length !== 1 ? 's' : ''}
                    {template.createdAt && ` • Created ${formatDate(template.createdAt)}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewingTemplate(template)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    title="View template details"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </button>
                  <button
                    onClick={() => {
                      onApply(template)
                      onClose()
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md bg-blue-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-900"
                    title="Apply template to current order"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Apply
                  </button>
                  <button
                    onClick={() => handleDelete(template)}
                    disabled={deletingId === template._id}
                    className="inline-flex items-center justify-center rounded-md border border-rose-200 px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                    title="Delete template"
                  >
                    {deletingId === template._id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-rose-600 border-t-transparent" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Template Detail View Modal */}
        {viewingTemplate && (
          <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4">
            <div className="mt-12 w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl max-h-[80vh] overflow-y-auto">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold text-slate-800">{viewingTemplate.name}</div>
                  <div className="text-xs text-slate-500">
                    {viewingTemplate.tests.length} test{viewingTemplate.tests.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <button
                  onClick={() => setViewingTemplate(null)}
                  className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-4">
                <div className="mb-2 text-sm font-medium text-slate-700">Tests in this template:</div>
                <div className="max-h-64 overflow-y-auto rounded-md border border-slate-200">
                  {viewingTemplate.tests.map((test, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0 odd:bg-slate-50"
                    >
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-800">
                        {idx + 1}
                      </div>
                      <span className="text-slate-700">{test}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setViewingTemplate(null)}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    onApply(viewingTemplate)
                    setViewingTemplate(null)
                    onClose()
                  }}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-800 px-4 py-2 text-sm font-medium text-white hover:bg-blue-900"
                >
                  <CheckCircle className="h-4 w-4" />
                  Apply Template
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Delete Confirmation Dialog */}
        {deleteConfirmTemplate && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100">
                  <Trash2 className="h-5 w-5 text-rose-600" />
                </div>
                <div>
                  <div className="text-lg font-semibold text-slate-800">Delete Template?</div>
                  <div className="text-sm text-slate-500">
                    Are you sure you want to delete "{deleteConfirmTemplate.name}"?
                  </div>
                </div>
              </div>

              <div className="mb-4 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
                This template contains {deleteConfirmTemplate.tests.length} test{deleteConfirmTemplate.tests.length !== 1 ? 's' : ''}.
                This action cannot be undone.
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setDeleteConfirmTemplate(null)}
                  disabled={deletingId === deleteConfirmTemplate._id}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deletingId === deleteConfirmTemplate._id}
                  className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {deletingId === deleteConfirmTemplate._id ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Re-export both components
export { AddTemplateDialogComponent as AddTemplateDialog }
export { ViewTemplatesDialog }
export default AddTemplateDialogComponent
