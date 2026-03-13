const fs = require('fs');
const path = require('path');

const filePath = 'g:\\HMS_Dr_Mujahid\\mujahid_hms_updated\\src\\pages\\doctor\\doctor_Prescription.tsx';

let content = fs.readFileSync(filePath, 'utf8');

// Use regex to be flexible about whitespace/indentation
// 1. State initialization
content = content.replace(
    /epidCst: \{[\s\S]*?side: .*?,[\s\S]*?\}/,
    `epidCst: {
        right: false,
        left: false,
      }`
);

content = content.replace(
    /varicocele: \{[\s\S]*?side: .*?,[\s\S]*?rightGrades: \{[\s\S]*?\},[\s\S]*?leftGrades: \{[\s\S]*?\},[\s\S]*?\}/,
    `varicocele: {
        right: false,
        left: false,
        rightGrades: { g1: false, g2: false, g3: false },
        leftGrades: { g1: false, g2: false, g3: false },
      }`
);

// 2. UI Updates
const newEpidUi = `                    <label className={checkboxCardLabelCls(!!sexualHistory.oe.epidCst.right)}>
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
                    </label>`;

const newVaricoUi = `                    <label className={checkboxCardLabelCls(!!sexualHistory.oe.varicocele.right)}>
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
                    </label>`;

const newGradeUi = `                  {!!sexualHistory.oe.varicocele.right && (
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
                  )}`;

// Replace Epi.D Cst UI
content = content.replace(
    /\{\(\['Right',\s*'Left'\] as const\)\.map\(opt => \([\s\S]*?<\/label>\s*?\)\)\}/,
    newEpidUi
);

// Replace Varicocle side UI (the next occurrence)
content = content.replace(
    /\{\(\['Right',\s*'Left'\] as const\)\.map\(opt => \([\s\S]*?<\/label>\s*?\)\)\}/,
    newVaricoUi
);

// Replace Varicocle grade UI
content = content.replace(
    /\{!!sexualHistory\.oe\.varicocele\.side && \([\s\S]*?<\/div>\s*?\)\}/,
    newGradeUi
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated doctor_Prescription.tsx');
