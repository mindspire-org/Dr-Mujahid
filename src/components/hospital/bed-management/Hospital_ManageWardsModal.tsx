import Hospital_Modal from './Hospital_Modal'

type WardRef = { id: string; name: string; floorId: string }

type FloorRef = { id: string; name: string }

type FloorsMap = Record<string, FloorRef>

export default function Hospital_ManageWardsModal({ open, onClose, wards, floorsMap, onDelete }: { open: boolean; onClose: () => void; wards: WardRef[]; floorsMap: FloorsMap; onDelete: (id: string) => void }) {
  return (
    <Hospital_Modal open={open} onClose={onClose}>
      <div className="px-1">
        <div className="text-lg font-semibold text-slate-800">Manage Wards</div>
        <div className="mt-4 space-y-3">
          {wards.map(w => (
            <div key={w.id} className="flex items-center justify-between rounded-md border border-slate-200 p-3">
              <div>
                <div className="font-medium text-slate-800">{w.name}</div>
                <div className="text-xs text-slate-500">Floor: {floorsMap[w.floorId]?.name || w.floorId}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onDelete(w.id)} className="rounded-md bg-rose-600 px-3 py-1.5 text-sm text-white">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Hospital_Modal>
  )
}
