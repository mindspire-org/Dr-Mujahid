/**
 * Utility for tracking doctor's edits on history fields and merging with original history data.
 * 
 * This implements the "delta tracking" pattern to avoid data duplication:
 * - Original history data is stored in HistoryTaking collection
 * - Only the fields modified by doctor are stored in Prescription.historyEdits
 * - When displaying, we merge original + edits and track which fields were edited
 */

export type HistorySection = 
  | 'personalInfo' 
  | 'maritalStatus' 
  | 'coitus' 
  | 'health' 
  | 'sexualHistory' 
  | 'previousMedicalHistory' 
  | 'arrivalReference'

export type HistoryEdits = {
  personalInfo?: any
  maritalStatus?: any
  coitus?: any
  health?: any
  sexualHistory?: any
  previousMedicalHistory?: any
  arrivalReference?: any
}

/**
 * Gets the value from an object by path (supports nested paths like 'erection.percentage')
 */
export function getValueByPath(obj: any, path: string): any {
  if (!obj || !path) return undefined
  const keys = path.split('.')
  let value = obj
  for (const key of keys) {
    if (value == null || typeof value !== 'object') return undefined
    value = value[key]
  }
  return value
}

/**
 * Sets a value in an object by path, creating nested objects as needed
 */
export function setValueByPath(obj: any, path: string, value: any): void {
  if (!obj || !path) return
  const keys = path.split('.')
  let current = obj
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (!(key in current) || current[key] == null || typeof current[key] !== 'object') {
      current[key] = {}
    }
    current = current[key]
  }
  current[keys[keys.length - 1]] = value
}

/**
 * Checks if two values are deeply equal (for primitive values and simple objects)
 */
export function isValueEqual(a: any, b: any): boolean {
  if (a === b) return true
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  if (typeof a !== typeof b) return false
  
  if (typeof a === 'object') {
    // Handle arrays
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false
      return a.every((val, idx) => isValueEqual(val, b[idx]))
    }
    if (Array.isArray(a) || Array.isArray(b)) return false
    
    // Handle objects
    const keysA = Object.keys(a)
    const keysB = Object.keys(b)
    if (keysA.length !== keysB.length) return false
    return keysA.every(key => isValueEqual(a[key], b[key]))
  }
  
  return false
}

/**
 * Extracts modified fields between original and current data
 * Returns only the fields that have changed (delta)
 */
export function extractHistoryEdits(
  original: any,
  current: any,
  _section?: HistorySection
): any | null {
  if (!current) return null
  if (!original) return current // All fields are new
  
  const edits: any = {}
  let hasEdits = false

  function extractObjectEdits(origObj: any, currObj: any): any | null {
    if (currObj == null || typeof currObj !== 'object') {
      return !isValueEqual(origObj, currObj) ? currObj : null
    }
    if (Array.isArray(currObj)) {
      // For arrays of objects we create a sparse array of per-index deltas.
      // For arrays of primitives, we store the full array when changed.
      const origArr = Array.isArray(origObj) ? origObj : []
      const currArr = currObj
      const origAllPrimitive = origArr.every((v: any) => v == null || typeof v !== 'object')
      const currAllPrimitive = currArr.every((v: any) => v == null || typeof v !== 'object')
      if (origAllPrimitive && currAllPrimitive) {
        return !isValueEqual(origArr, currArr) ? currArr : null
      }

      const maxLen = Math.max(origArr.length, currArr.length)
      const sparse: any[] = new Array(maxLen).fill(null)
      let any = false
      for (let i = 0; i < maxLen; i++) {
        const o = origArr[i]
        const c = currArr[i]
        if (c == null && o == null) continue
        if (c == null) {
          // Removal (not typical in these forms). Treat as full replace.
          return currArr
        }
        if (o == null) {
          sparse[i] = c
          any = true
          continue
        }
        const d = extractObjectEdits(o, c)
        if (d != null && !(typeof d === 'object' && !Array.isArray(d) && Object.keys(d).length === 0)) {
          sparse[i] = d
          any = true
        }
      }
      return any ? sparse : null
    }

    // Plain object
    const out: any = {}
    let any = false
    const allKeys = new Set([...Object.keys(origObj || {}), ...Object.keys(currObj)])
    for (const k of allKeys) {
      const d = extractObjectEdits(origObj?.[k], currObj[k])
      if (d != null) {
        out[k] = d
        any = true
      }
    }
    return any ? out : null
  }
  
  function compareRecursive(orig: any, curr: any, path: string = '') {
    if (typeof curr !== 'object' || curr == null) {
      // Primitive value
      if (!isValueEqual(orig, curr)) {
        setValueByPath(edits, path, curr)
        hasEdits = true
      }
      return
    }
    
    if (Array.isArray(curr)) {
      const delta = extractObjectEdits(orig, curr)
      if (delta != null) {
        setValueByPath(edits, path, delta)
        hasEdits = true
      }
      return
    }
    
    // Object - recursively compare
    const allKeys = new Set([...Object.keys(orig || {}), ...Object.keys(curr)])
    for (const key of allKeys) {
      const newPath = path ? `${path}.${key}` : key
      compareRecursive(
        orig?.[key],
        curr[key],
        newPath
      )
    }
  }
  
  compareRecursive(original, current)
  return hasEdits ? edits : null
}

/**
 * Merges original history data with doctor's edits
 * Returns the merged data and a Set of paths that were edited by doctor
 */
export function mergeHistoryWithEdits(
  original: any,
  edits: any,
  _section?: HistorySection
): { data: any; editedPaths: Set<string> } {
  const editedPaths = new Set<string>()
  
  if (!edits) {
    return { data: original || {}, editedPaths }
  }
  
  const merged = JSON.parse(JSON.stringify(original || {}))

  function collectEditedLeafPathsFromArray(originalArr: any[], editedArr: any[], basePath: string) {
    // For arrays of objects, mark only the specific leaf fields that differ.
    // For arrays of primitives, mark additions as `${basePath}.${value}`.
    const origIsArray = Array.isArray(originalArr)
    const editIsArray = Array.isArray(editedArr)
    if (!origIsArray || !editIsArray) {
      editedPaths.add(basePath)
      return
    }

    const origAllPrimitive = originalArr.every(v => v == null || typeof v !== 'object')
    const editAllPrimitive = editedArr.every(v => v == null || typeof v !== 'object')

    if (origAllPrimitive && editAllPrimitive) {
      const origSet = new Set(originalArr.map(v => String(v).trim()))
      for (const v of editedArr) {
        const key = String(v).trim()
        if (!origSet.has(key)) editedPaths.add(`${basePath}.${key}`)
      }
      return
    }

    const maxLen = Math.max(originalArr.length, editedArr.length)
    for (let i = 0; i < maxLen; i++) {
      const o = originalArr[i]
      const e = editedArr[i]
      const idxPath = `${basePath}.${i}`
      if (e == null && o == null) continue
      if (typeof e !== 'object' || e == null) {
        if (!isValueEqual(o, e)) editedPaths.add(idxPath)
        continue
      }
      if (Array.isArray(e)) {
        if (!Array.isArray(o)) {
          editedPaths.add(idxPath)
        } else {
          collectEditedLeafPathsFromArray(o, e, idxPath)
        }
        continue
      }

      // object element
      const keys = new Set([...Object.keys(o || {}), ...Object.keys(e)])
      for (const k of keys) {
        const leafPath = `${idxPath}.${k}`
        const ov = o?.[k]
        const ev = e?.[k]
        if (ev != null && typeof ev === 'object') {
          if (Array.isArray(ev)) {
            if (!Array.isArray(ov)) {
              editedPaths.add(leafPath)
            } else {
              collectEditedLeafPathsFromArray(ov, ev, leafPath)
            }
          } else {
            // nested object: recurse using mergeRecursive-like behavior by diffing
            // (avoid marking parent path; mark leaves only)
            const nestedKeys = new Set([...Object.keys(ov || {}), ...Object.keys(ev)])
            for (const nk of nestedKeys) {
              const nLeafPath = `${leafPath}.${nk}`
              if (!isValueEqual(ov?.[nk], ev?.[nk])) editedPaths.add(nLeafPath)
            }
          }
        } else {
          if (!isValueEqual(ov, ev)) editedPaths.add(leafPath)
        }
      }
    }
  }
  
  function mergeRecursive(editObj: any, target: any, path: string = '') {
    if (!editObj || typeof editObj !== 'object') return
    
    for (const [key, value] of Object.entries(editObj)) {
      const currentPath = path ? `${path}.${key}` : key
      
      if (value != null && typeof value === 'object' && !Array.isArray(value)) {
        // Nested object
        if (!target[key] || typeof target[key] !== 'object') {
          target[key] = {}
        }
        mergeRecursive(value, target[key], currentPath)
      } else if (Array.isArray(value)) {
        // Array: support sparse array edits (null entries mean unchanged)
        const originalValue = target[key]
        if (Array.isArray(originalValue)) {
          const looksSparse = value.some((v: any) => v == null) && value.some((v: any) => v != null)
          if (looksSparse) {
            const maxLen = Math.max(originalValue.length, value.length)
            const out: any[] = JSON.parse(JSON.stringify(originalValue))
            for (let i = 0; i < maxLen; i++) {
              const patch = (value as any[])[i]
              if (patch == null) continue
              if (typeof patch === 'object' && !Array.isArray(patch) && patch != null) {
                if (out[i] == null || typeof out[i] !== 'object') out[i] = {}
                mergeRecursive(patch, out[i], `${currentPath}.${i}`)
              } else {
                out[i] = patch
                editedPaths.add(`${currentPath}.${i}`)
              }
            }
            target[key] = out
            // Even with sparse edits, compute leaf paths by diffing final array against original.
            collectEditedLeafPathsFromArray(originalValue, out, currentPath)
          } else {
            target[key] = value
            collectEditedLeafPathsFromArray(originalValue, value, currentPath)
          }
        } else {
          target[key] = value
          editedPaths.add(currentPath)
        }
      } else {
        // Primitive value
        target[key] = value
        editedPaths.add(currentPath)
      }
    }
  }
  
  mergeRecursive(edits, merged)
  return { data: merged, editedPaths }
}

/**
 * Collects all history edits from all sections
 * Call this before saving prescription to build the historyEdits payload
 */
export function collectAllHistoryEdits(
  originalHistory: any,
  currentHistory: {
    personalInfo?: any
    maritalStatus?: any
    coitus?: any
    health?: any
    sexualHistory?: any
    previousMedicalHistory?: any
    arrivalReference?: any
  }
): HistoryEdits | null {
  const sections: HistorySection[] = [
    'personalInfo',
    'maritalStatus',
    'coitus',
    'health',
    'sexualHistory',
    'previousMedicalHistory',
    'arrivalReference'
  ]
  
  const historyEdits: HistoryEdits = {}
  let hasAnyEdits = false
  
  for (const section of sections) {
    const original = originalHistory?.[section]
    const current = currentHistory[section]
    
    const edits = extractHistoryEdits(original, current, section)
    if (edits) {
      historyEdits[section] = edits
      hasAnyEdits = true
    }
  }
  
  return hasAnyEdits ? historyEdits : null
}

/**
 * Checks if a specific field path was edited by doctor
 */
export function isFieldEditedByDoctor(
  editedPaths: Set<string>,
  fieldPath: string
): boolean {
  // Check exact match or if parent path is edited
  if (editedPaths.has(fieldPath)) return true
  
  // Check if any parent path is edited (e.g., if 'erection' is edited, 'erection.percentage' is also considered edited)
  for (const editedPath of editedPaths) {
    if (fieldPath.startsWith(editedPath + '.')) return true
  }
  
  return false
}

/**
 * Gets display styles for a field based on whether it was edited by doctor
 */
export function getFieldDisplayStyles(
  editedPaths: Set<string>,
  fieldPath: string,
  baseClasses: string = ''
): { className: string; title?: string } {
  const isEdited = isFieldEditedByDoctor(editedPaths, fieldPath)
  
  if (isEdited) {
    return {
      className: `${baseClasses} text-blue-600 font-medium`.trim(),
      title: 'Edited by doctor'
    }
  }
  
  return {
    className: `${baseClasses} text-slate-900`.trim(),
    title: undefined
  }
}
