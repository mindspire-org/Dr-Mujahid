import { z } from 'zod'

export const createExpenseSchema = z.object({
  dateIso: z.string().min(1),
  departmentId: z.string().optional(),
  category: z.string().min(1),
  amount: z.number().min(0),
  note: z.string().optional(),
  method: z.string().optional(),
  ref: z.string().optional(),
  supplierName: z.string().optional(),
  invoiceNo: z.string().optional(),
  kind: z.string().optional(),
  staffId: z.string().optional(),
  salaryMonth: z.string().optional(),
  paymentMode: z.string().optional(),
  fromAccountCode: z.string().optional(),
})

export const listExpenseSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  status: z.enum(['all','draft','submitted','approved','rejected']).optional(),
  kind: z.string().optional(),
  staffId: z.string().optional(),
  salaryMonth: z.string().optional(),
  category: z.string().optional(),
})
