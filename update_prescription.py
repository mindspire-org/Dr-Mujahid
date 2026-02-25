import os

file_path = r'g:\HMS_Dr_Mujahid\mujahid_hms_updated\src\pages\doctor\doctor_Prescription.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update state initialization
content = content.replace(
    "      epidCst: {\n        side: '' as '' | 'Right' | 'Left',\n      },",
    "      epidCst: {\n        right: false,\n        left: false,\n      },"
)
content = content.replace(
    "      varicocele: {\n        side: '' as '' | 'Right' | 'Left',\n        rightGrades: { g1: false, g2: false, g3: false },\n        leftGrades: { g1: false, g2: false, g3: false },\n      },",
    "      varicocele: {\n        right: false,\n        left: false,\n        rightGrades: { g1: false, g2: false, g3: false },\n        leftGrades: { g1: false, g2: false, g3: false },\n      },"
)

# 2. Update UI for Epi.D Cst
old_epid_ui = """                    {(['Right', 'Left'] as const).map(opt => (
                      <label key={opt} className={checkboxCardLabelCls(sexualHistory.oe.epidCst.side === opt)}>
                        <input
                          type="checkbox"
                          checked={sexualHistory.oe.epidCst.side === opt}
                          onChange={(e)=>setSexualHistory(s=>({ ...s, oe: { ...s.oe, epidCst: { ...s.oe.epidCst, side: e.target.checked ? opt : '' } } }))}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        {opt}
                      </label>
                    ))}"""

new_epid_ui = """                    <label className={checkboxCardLabelCls(!!sexualHistory.oe.epidCst.right)}>
                      <input
                        type="checkbox"
                        checked={!!sexualHistory.oe.epidCst.right}
                        onChange={(e) => setSexualHistory(s => ({ ...s, oe: { ...s.oe, epidCst: { ...s.oe.epidCst, right: e.target.checked } } }))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Right
                    </label>
                    <label className={checkboxCardLabelCls(!!sexualHistory.oe.epidCst.left)}>
                      <input
                        type="checkbox"
                        checked={!!sexualHistory.oe.epidCst.left}
                        onChange={(e) => setSexualHistory(s => ({ ...s, oe: { ...s.oe, epidCst: { ...s.oe.epidCst, left: e.target.checked } } }))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Left
                    </label>"""

# 3. Update UI for Varicocle
old_varico_ui = """                    {(['Right','Left'] as const).map(opt => (
                      <label key={opt} className={checkboxCardLabelCls(sexualHistory.oe.varicocele.side === opt)}>
                        <input
                          type="checkbox"
                          checked={sexualHistory.oe.varicocele.side === opt}
                          onChange={(e)=>setSexualHistory(s=>({
                            ...s,
                            oe: {
                                ...s.oe,
                                varicocele: {
                                  ...s.oe.varicocele,
                                  side: e.target.checked ? opt : '',
                                },
                            },
                          }))}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        {opt}
                      </label>
                    ))}"""

new_varico_ui = """                    <label className={checkboxCardLabelCls(!!sexualHistory.oe.varicocele.right)}>
                      <input
                        type="checkbox"
                        checked={!!sexualHistory.oe.varicocele.right}
                        onChange={(e) => setSexualHistory(s => ({ ...s, oe: { ...s.oe, varicocele: { ...s.oe.varicocele, right: e.target.checked } } }))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Right
                    </label>
                    <label className={checkboxCardLabelCls(!!sexualHistory.oe.varicocele.left)}>
                      <input
                        type="checkbox"
                        checked={!!sexualHistory.oe.varicocele.left}
                        onChange={(e) => setSexualHistory(s => ({ ...s, oe: { ...s.oe, varicocele: { ...s.oe.varicocele, left: e.target.checked } } }))}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Left
                    </label>"""

# Note: The Varicocle side check might have spacing differences in real file.
# I'll use a more flexible replacement for UI parts if possible, but let's try direct first.

# 4. Update Varicocle Grade UI
old_grade_ui = """                  {!!sexualHistory.oe.varicocele.side && (
                    <div className="mt-3 flex flex-wrap items-center gap-6">
                      {(['G1', 'G2', 'G3'] as const).map(g => (
                        <label key={g} className={checkboxCardLabelCls((sexualHistory.oe.varicocele.rightGrades as any)[g])}>
                          <input
                            type="checkbox"
                            checked={
                              sexualHistory.oe.varicocele.side === 'Right'
                                ? !!(sexualHistory.oe.varicocele.rightGrades as any)[g.toLowerCase()]
                                : !!(sexualHistory.oe.varicocele.leftGrades as any)[g.toLowerCase()]
                            }
                            onChange={(e) => setSexualHistory(s => {
                              const side = s.oe.varicocele.side
                              const key = g.toLowerCase() as 'g1' | 'g2' | 'g3'
                              const nextVar = { ...s.oe.varicocele }
                              if (side === 'Right') nextVar.rightGrades = { ...nextVar.rightGrades, [key]: e.target.checked }
                              if (side === 'Left') nextVar.leftGrades = { ...nextVar.leftGrades, [key]: e.target.checked }
                              return { ...s, oe: { ...s.oe, varicocele: nextVar } }
                            })}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          {g}
                        </label>
                      ))}
                    </div>
                  )}"""

new_grade_ui = """                  {!!sexualHistory.oe.varicocele.right && (
                    <div className="mt-3 flex flex-wrap items-center gap-6">
                      <div className="text-xs font-semibold text-slate-600">Right Grades:</div>
                      {(['G1', 'G2', 'G3'] as const).map(g => (
                        <label key={'right_' + g} className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={!!(sexualHistory.oe.varicocele.rightGrades as any)[g.toLowerCase()]}
                            onChange={(e) => setSexualHistory(s => ({
                              ...s,
                              oe: {
                                ...s.oe,
                                varicocele: {
                                  ...s.oe.varicocele,
                                  rightGrades: { ...s.oe.varicocele.rightGrades, [g.toLowerCase()]: e.target.checked },
                                },
                              },
                            }))}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          {g}
                        </label>
                      ))}
                    </div>
                  )}

                  {!!sexualHistory.oe.varicocele.left && (
                    <div className="mt-3 flex flex-wrap items-center gap-6">
                      <div className="text-xs font-semibold text-slate-600">Left Grades:</div>
                      {(['G1', 'G2', 'G3'] as const).map(g => (
                        <label key={'left_' + g} className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={!!(sexualHistory.oe.varicocele.leftGrades as any)[g.toLowerCase()]}
                            onChange={(e) => setSexualHistory(s => ({
                              ...s,
                              oe: {
                                ...s.oe,
                                varicocele: {
                                  ...s.oe.varicocele,
                                  leftGrades: { ...s.oe.varicocele.leftGrades, [g.toLowerCase()]: e.target.checked },
                                },
                              },
                            }))}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          {g}
                        </label>
                      ))}
                    </div>
                  )}"""

# I'll use regex for more robust replacement of UI blocks if direct fails.
import re

def fix_ui(content):
    # Flexible match for Epi.D Cst
    content = re.sub(
        r'div className="text-sm text-slate-700">Epi\.D Cst</div>\s*<div className="mt-3 grid gap-2 sm:grid-cols-2">.*?</div>\s*</div>',
        lambda m: 'div className="text-sm text-slate-700">Epi.D Cst</div>\n                  <div className="mt-3 grid gap-2 sm:grid-cols-2">\n' + new_epid_ui + '\n                  </div>\n                </div>',
        content, flags=re.DOTALL
    )
    # Flexible match for Varicocle side selection
    content = re.sub(
        r'div className="text-sm text-slate-700">Varicocle</div>\s*<div className="mt-3 grid gap-2 sm:grid-cols-2">.*?</div>\s*</div>',
        lambda m: 'div className="text-sm text-slate-700">Varicocle</div>\n                  <div className="mt-3 grid gap-2 sm:grid-cols-2">\n' + new_varico_ui + '\n                  </div>\n' + new_grade_ui + '\n                </div>',
        content, flags=re.DOTALL
    )
    # Remove the old grade UI if it's still there separately (it shouldn't be if above regex matched well)
    return content

# content = fix_ui(content)

# Actually, I'll just do very careful string replacements for the state first.
content = re.sub(r'epidCst: \{\s*side: .*?,\s*\},', 'epidCst: {\n        right: false,\n        left: false,\n      },', content)
content = re.sub(r'varicocele: \{\s*side: .*?,\s*rightGrades: \{.*?\},\s*leftGrades: \{.*?\},\s*\},', 'varicocele: {\n        right: false,\n        left: false,\n        rightGrades: { g1: false, g2: false, g3: false },\n        leftGrades: { g1: false, g2: false, g3: false },\n      },', content, flags=re.DOTALL)

# And UI
content = re.sub(r'\{\(\[\'Right\', \'Left\'\] as const\)\.map\(opt => \(.*?<\/label>\s*?\)\)\}', new_epid_ui, content, count=1, flags=re.DOTALL)
# The second one is Varicocle
content = re.sub(r'\{\(\[\'Right\', \'Left\'\] as const\)\.map\(opt => \(.*?<\/label>\s*?\)\)\}', new_varico_ui, content, count=1, flags=re.DOTALL)

# And Grade UI
content = re.sub(r'\{!!sexualHistory\.oe\.varicocele\.side && \(.*?\)\}', new_grade_ui, content, count=1, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated doctor_Prescription.tsx")
