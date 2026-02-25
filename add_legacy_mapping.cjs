const fs = require('fs');

const filePath = 'g:\\HMS_Dr_Mujahid\\mujahid_hms_updated\\src\\pages\\doctor\\doctor_Prescription.tsx';

let content = fs.readFileSync(filePath, 'utf8');

const oldLine = '                setSexualHistory(nextSexualHistory)';
const newLine = `                if (nextSexualHistory.oe?.epidCst?.side) {
                  if (nextSexualHistory.oe.epidCst.side === 'Right') nextSexualHistory.oe.epidCst.right = true;
                  if (nextSexualHistory.oe.epidCst.side === 'Left') nextSexualHistory.oe.epidCst.left = true;
                }
                if (nextSexualHistory.oe?.varicocele?.side) {
                  if (nextSexualHistory.oe.varicocele.side === 'Right') nextSexualHistory.oe.varicocele.right = true;
                  if (nextSexualHistory.oe.varicocele.side === 'Left') nextSexualHistory.oe.varicocele.left = true;
                }
                setSexualHistory(nextSexualHistory)`;

content = content.replace(oldLine, newLine);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully added legacy mapping to doctor_Prescription.tsx');
