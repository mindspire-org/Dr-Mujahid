import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { hospitalApi } from '../../utils/api'

 type ExpenseInput = {
  date: string
  category: 'Rent' | 'Utilities' | 'Supplies' | 'Salaries' | 'Maintenance' | 'Other'
  note: string
  amount: string
  method: 'cash' | 'bank' | 'card'
  reference?: string
  department: string
  fromAccountCode: string
  supplierName: string
  invoiceNo: string
}


// No localStorage fallback; rely on backend departments

export default function Finance_AddExpense() {
  const navigate = useNavigate()
  const location = useLocation()
  const base = location.pathname.startsWith('/hospital/') ? '/hospital/finance' : '/finance'
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([])
  const [accounts, setAccounts] = useState<Array<{ code: string; label: string }>>([])
  const [form, setForm] = useState<ExpenseInput>({
    date: new Date().toISOString().slice(0,10),
    category: 'Supplies',
    note: '',
    amount: '',
    method: 'cash',
    reference: '',
    department: 'OPD',
    fromAccountCode: '',
    supplierName: '',
    invoiceNo: '',
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res: any = await hospitalApi.listDepartments()
        const list: Array<{ id: string; name: string }> = (res?.departments || res || []).map((d: any) => ({ id: String(d._id || d.id), name: d.name }))
        if (!cancelled) {
          setDepartments(list)
          if (list.length) setForm(f => ({ ...f, department: list[0].name }))
        }
      } catch {
        if (!cancelled) setDepartments([])
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [pettyRes, bankRes]: any[] = await Promise.all([
          hospitalApi.listPettyCashAccounts({ status: 'Active' } as any),
          hospitalApi.listBankAccounts({ status: 'Active' } as any),
        ])
        const petty = (pettyRes?.accounts || []).map((a: any) => ({
          code: String(a.code || '').trim().toUpperCase(),
          label: `Petty: ${String(a.name || a.code || '').trim()}`.trim(),
        })).filter((x: any) => x.code)
        const bank = (bankRes?.accounts || []).map((b: any) => ({
          code: String(b.financeAccountCode || '').trim().toUpperCase(),
          label: `Bank: ${String(b.bankName || '').trim()} - ${String(b.accountTitle || '').trim()}`.trim(),
        })).filter((x: any) => x.code)
        const all = [...petty, ...bank]
        if (!cancelled) {
          setAccounts(all)
          if (all.length) setForm(f => ({ ...f, fromAccountCode: f.fromAccountCode || all[0].code }))
        }
      } catch {
        if (!cancelled) setAccounts([])
      }
    })()
    return () => { cancelled = true }
  }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(form.amount || '0')
    if (!amt) return
    try {
      const sel = departments.find(d => d.name === form.department)
      await hospitalApi.createExpense({
        dateIso: form.date,
        departmentId: sel?.id,
        category: form.category,
        amount: amt,
        note: form.note?.trim() || undefined,
        method: form.method,
        ref: form.reference?.trim() || undefined,
        supplierName: form.category === 'Supplies' ? (form.supplierName?.trim() || undefined) : undefined,
        invoiceNo: form.category === 'Supplies' ? (form.invoiceNo?.trim() || undefined) : undefined,
        fromAccountCode: form.fromAccountCode?.trim() || undefined,
      })
      navigate(`${base}/expenses`)
    } catch (err: any) {
      alert(err?.message || 'Failed to save expense')
    }
  }

  return (
    <div className="w-full px-6 py-8">
      <div className="text-2xl font-bold text-slate-800">Add Expense</div>

      <form onSubmit={save} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-slate-700">Department</label>
            <select value={form.department} onChange={e=>setForm(f=>({ ...f, department: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              {departments.map(dep => (<option key={dep.id} value={dep.name}>{dep.name}</option>))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">Account</label>
            <select value={form.fromAccountCode} onChange={e=>setForm(f=>({ ...f, fromAccountCode: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required>
              {accounts.map(a => (<option key={a.code} value={a.code}>{a.label}</option>))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">Date</label>
            <input type="date" value={form.date} onChange={e=>setForm(f=>({ ...f, date: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">Category</label>
            <select value={form.category} onChange={e=>setForm(f=>({ ...f, category: e.target.value as ExpenseInput['category'], supplierName: e.target.value === 'Supplies' ? f.supplierName : '', invoiceNo: e.target.value === 'Supplies' ? f.invoiceNo : '' }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option>Rent</option>
              <option>Utilities</option>
              <option>Supplies</option>
              <option>Salaries</option>
              <option>Maintenance</option>
              <option>Other</option>
            </select>
          </div>
          {form.category === 'Supplies' && (
            <>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Supplier Name</label>
                <input value={form.supplierName} onChange={e=>setForm(f=>({ ...f, supplierName: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Supplier" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Invoice</label>
                <input value={form.invoiceNo} onChange={e=>setForm(f=>({ ...f, invoiceNo: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Invoice #" />
              </div>
            </>
          )}
          <div>
            <label className="mb-1 block text-sm text-slate-700">Amount</label>
            <input type="number" step="0.01" value={form.amount} onChange={e=>setForm(f=>({ ...f, amount: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="0.00" required />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">Payment Method</label>
            <select value={form.method} onChange={e=>setForm(f=>({ ...f, method: e.target.value as ExpenseInput['method'] }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option>cash</option>
              <option>bank</option>
              <option>card</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-slate-700">Reference</label>
            <input value={form.reference} onChange={e=>setForm(f=>({ ...f, reference: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="e.g., EXP-000045" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-slate-700">Note</label>
            <textarea value={form.note} onChange={e=>setForm(f=>({ ...f, note: e.target.value }))} rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Optional" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Link to={`${base}/transactions`} className="btn-outline-navy">Cancel</Link>
          <button type="submit" className="btn">Save Draft</button>
        </div>
      </form>
    </div>
  )
}
