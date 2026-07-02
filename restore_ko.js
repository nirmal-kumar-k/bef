const fs = require('fs');
const lines = fs.readFileSync('C:/Users/Nirmal/.gemini/antigravity-ide/brain/889916bb-2177-42bf-9bdc-ceae9fef7445/.system_generated/logs/transcript_full.jsonl', 'utf8').split('\n');
const files = {};

// Reconstruct files from the transcript exactly as replay.js did, but only saving the output for knockout files
for (let i = 0; i < lines.length; i++) {
  if (!lines[i]) continue;
  try {
    const j = JSON.parse(lines[i]);
    if (j.step_index >= 8656 && j.step_index <= 11328 && j.type === 'PLANNER_RESPONSE' && j.tool_calls) {
      for (const tc of j.tool_calls) {
        if (tc.name === 'write_to_file') {
          files[tc.args.TargetFile] = tc.args.CodeContent;
        } else if (tc.name === 'replace_file_content' && files[tc.args.TargetFile]) {
          files[tc.args.TargetFile] = files[tc.args.TargetFile].replace(tc.args.TargetContent, tc.args.ReplacementContent);
        } else if (tc.name === 'multi_replace_file_content' && files[tc.args.TargetFile]) {
          for (const chunk of tc.args.ReplacementChunks) {
            if (chunk.AllowMultiple) {
              files[tc.args.TargetFile] = files[tc.args.TargetFile].split(chunk.TargetContent).join(chunk.ReplacementContent);
            } else {
              files[tc.args.TargetFile] = files[tc.args.TargetFile].replace(chunk.TargetContent, chunk.ReplacementContent);
            }
          }
        } else if (tc.name === 'run_command' && tc.args.CommandLine.includes('fs.writeFileSync')) {
           // Emulate the node -e script that created knockout files
           if (tc.args.CommandLine.includes('knockout-planning-modal.tsx')) {
               // The agent wrote the file manually in a node script by copying mould-planning-modal
               const codeMatch = tc.args.CommandLine.match(/fs\.writeFileSync\('.*?knockout-planning-modal\.tsx', `([\s\S]+?)`\)/);
               if (codeMatch) files['d:\\BEF\\src\\modules\\production\\presentation\\knockout-planning-modal.tsx'] = codeMatch[1];
           }
           if (tc.args.CommandLine.includes('knockout-planning-tab.tsx')) {
               const codeMatch = tc.args.CommandLine.match(/fs\.writeFileSync\('.*?knockout-planning-tab\.tsx', `([\s\S]+?)`\)/);
               if (codeMatch) files['d:\\BEF\\src\\modules\\production\\presentation\\knockout-planning-tab.tsx'] = codeMatch[1];
           }
        }
      }
    }
  } catch(e) {}
}

for (const [k, v] of Object.entries(files)) {
  if (k.includes('knockout-planning')) {
    fs.mkdirSync(require('path').dirname(k), {recursive: true});
    fs.writeFileSync(k, v, 'utf8');
    console.log('Restored: ' + k);
  }
}
